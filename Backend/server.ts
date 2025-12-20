import express from "express";
import { createServer } from "node:http";
import { Server } from "socket.io";
import cors from "cors";
import questions from "./questions.json";

/* =======================
   Setup
======================= */

const app = express();
const server = createServer(app);

const io = new Server(server, {
    cors: {
        origin: "http://localhost:5173",
        methods: ["GET", "POST"],
        credentials: true,
    },
});

app.use(cors());

/* =======================
   Types
======================= */

type User = {
    name: string;
    socketId: string;
    online: boolean;
    isAdmin: boolean;
};

type Question = { question: string };

type GameQuestion = {
    question: string;
    aboutUserId: string;
    answeredByUserId: string;
    answer?: string;
};

type PlayerQueue = {
    questions: GameQuestion[];
    currentIndex: number;
    finished: boolean;
};

type RoomUsers = Map<string, User>;

type RoomState = {
    users: RoomUsers;
    creatorId: string;
    open: boolean;
    playerQueues: Map<string, PlayerQueue>;
};

/* =======================
   Data
======================= */

const questionsArray: string[] = (questions.questions as Question[]).map(
    (q) => q.question
);

const activeRooms = new Map<string, RoomState>();

/* =======================
   Helpers
======================= */

const shuffle = <T>(array: T[]): T[] => [...array].sort(() => Math.random() - 0.5);

const pickRandomQuestions = (count: number): string[] =>
    shuffle(questionsArray).slice(0, count);

const broadcastRoomUsers = (roomId: string, userId?: string) => {
    const room = activeRooms.get(roomId);
    if (!room) return;

    const usersData = Array.from(room.users.entries()).map(([uid, user]) => ({
        userId: uid,
        name: user.name,
        online: user.online,
        isAdmin: user.isAdmin,
        isYou: uid === userId,
    }));

    io.to(roomId).emit("roomUsers", {
        roomId,
        users: usersData,
    });
};

/* =======================
   Game Helpers
======================= */

const sendNextQuestion = (roomId: string, userId: string) => {
    const room = activeRooms.get(roomId);
    if (!room) return;

    const queue = room.playerQueues.get(userId);
    if (!queue || queue.finished) return;

    const q = queue.questions[queue.currentIndex];

    // Player finished all questions
    if (!q) {
        queue.finished = true;

        const allFinished = Array.from(room.playerQueues.values()).every(
            (q) => q.finished
        );

        if (allFinished) {
            console.log("===== GAME FINISHED =====");
            console.log("Room:", roomId);

            for (const [, pq] of room.playerQueues) {
                for (const entry of pq.questions) {
                    console.log({
                        question: entry.question,
                        answer: entry.answer,
                        answeredBy: room.users.get(entry.answeredByUserId)?.name,
                        aboutUser: room.users.get(entry.aboutUserId)?.name,
                    });
                }
            }

            console.log("===== END OF GAME =====");
            io.to(roomId).emit("gameFinished");
        }

        return;
    }

    const answeredBy = room.users.get(userId);
    const aboutUser = room.users.get(q.aboutUserId);
    if (!answeredBy || !aboutUser) return;

    io.to(answeredBy.socketId).emit("question", {
        question: q.question,
        aboutUserId: q.aboutUserId,
        aboutUserName: aboutUser.name,
        answeredByUserId: userId,
        answeredByUserName: answeredBy.name,
        index: queue.currentIndex,
        total: queue.questions.length,
    });
};

/* =======================
   Routes
======================= */

app.get("/", (_, res) => {
    res.send("<h1>Hello Goon</h1>");
});

/* =======================
   Socket Logic
======================= */

io.on("connection", (socket) => {
    const userId = socket.handshake.auth.userId;

    if (!userId) {
        socket.disconnect();
        return;
    }

    console.log("connected:", userId, socket.id);

    /* ===== Create Room ===== */

    socket.on("createRoom", () => {
        let id = "";

        while (true) {
            id = "";
            for (let i = 0; i < 6; i++) {
                id += Math.floor(Math.random() * 10);
            }
            if (!activeRooms.has(id)) break;
        }

        activeRooms.set(id, {
            users: new Map(),
            creatorId: userId,
            open: true,
            playerQueues: new Map(),
        });

        socket.emit("roomCreated", id);
    });

    /* ===== Join Room ===== */

    socket.on("joinRoom", ({ roomId, name }) => {
        const room = activeRooms.get(roomId);
        if (!room) {
            socket.emit("roomNotFound");
            return;
        }

        const existing = room.users.get(userId);

        if (!room.open && !existing) {
            socket.emit("roomNotOpen");
            return;
        }

        if (existing) {
            existing.socketId = socket.id;
            existing.online = true;
            existing.name = name;
        } else {
            room.users.set(userId, {
                name,
                socketId: socket.id,
                online: true,
                isAdmin: room.creatorId === userId,
            });
        }

        socket.join(roomId);

        socket.emit("joinedRoom", {
            roomId,
            name,
            isAdmin: room.users.get(userId)?.isAdmin,
            open: room.open,
        });

        broadcastRoomUsers(roomId, userId);
    });

    /* ===== Leave Room ===== */

    socket.on("leaveRoom", ({ roomId }) => {
        const room = activeRooms.get(roomId);
        if (!room) return;

        room.users.delete(userId);
        room.playerQueues.delete(userId);
        socket.leave(roomId);

        socket.emit("leftRoom");

        if (room.users.size === 0) {
            activeRooms.delete(roomId);
        } else {
            broadcastRoomUsers(roomId);
        }
    });

    /* ===== Disconnect ===== */

    socket.on("disconnect", () => {
        for (const [roomId, room] of activeRooms) {
            const user = room.users.get(userId);
            if (!user || user.socketId !== socket.id) continue;

            user.online = false;
            user.socketId = "";

            broadcastRoomUsers(roomId);
        }
    });

    /* ===== Close Room ===== */

    socket.on("closeRoom", ({ roomId }) => {
        const room = activeRooms.get(roomId);
        if (room && room.creatorId === userId) {
            io.to(roomId).emit("closedRoom");
            activeRooms.delete(roomId);
        }
    });

    /* =======================
       Game Logic
    ======================= */

    socket.on("startGame", ({ roomId }) => {
        const room = activeRooms.get(roomId);
        if (!room || room.creatorId !== userId) return;

        room.open = false;
        room.playerQueues.clear();

        const userIds = Array.from(room.users.keys());

        for (const answeredBy of userIds) {
            const questionsForPlayer: GameQuestion[] = [];

            for (const aboutUser of userIds) {
                if (answeredBy === aboutUser) continue;

                const qs = pickRandomQuestions(2);
                for (const q of qs) {
                    questionsForPlayer.push({
                        question: q,
                        aboutUserId: aboutUser,
                        answeredByUserId: answeredBy,
                    });
                }
            }

            room.playerQueues.set(answeredBy, {
                questions: shuffle(questionsForPlayer),
                currentIndex: 0,
                finished: false,
            });
        }

        io.to(roomId).emit("startedGame");

        // Send first question to everyone
        for (const uid of userIds) {
            sendNextQuestion(roomId, uid);
        }
    });

    socket.on("answerQuestion", ({ roomId, answer }) => {
        const room = activeRooms.get(roomId);
        if (!room) return;

        const queue = room.playerQueues.get(userId);
        if (!queue || queue.finished) return;

        const q = queue.questions[queue.currentIndex];
        if (!q) return;

        q.answer = answer;
        queue.currentIndex++;

        sendNextQuestion(roomId, userId);
    });
});

/* =======================
   Start Server
======================= */

server.listen(3000, () => {
    console.log("server running at http://localhost:3000");
});
