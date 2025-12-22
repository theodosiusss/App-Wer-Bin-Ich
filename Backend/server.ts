import express from "express";
import {createServer} from "node:http";
import {Server} from "socket.io";
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

type VoteRound = {
    profileUserId: string;
    votes: Map<string, string>; // voterId → guessedUserId
};


type RoomState = {
    users: RoomUsers;
    creatorId: string;
    open: boolean;
    playerQueues: Map<string, PlayerQueue>;
    profiles: Map<string, string>;
    votingIndex: number;
    votingOrder: string[];
    currentVote: VoteRound | null;
    finalScores: Map<string, number>;
    gameFinished: boolean;

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
        isAdmin: user.isAdmin}));

    io.to(roomId).emit("roomUsers", {
        roomId,
        users: usersData,
    });
};

/* =======================
   Game Helpers
======================= */

const sendNextQuestion = async (roomId: string, userId: string) => {
    const room = activeRooms.get(roomId);
    if (!room) return;

    const queue = room.playerQueues.get(userId);
    if (!queue) return;
    if (queue && queue.finished) {
        const user = room.users.get(userId);
        io.to(user.socketId).emit("doneWithQuestions");
        return;
    }

    const q = queue.questions[queue.currentIndex];

    // Player finished all questions
    if (!q) {
        queue.finished = true;
        const user = room.users.get(userId);
        io.to(user.socketId).emit("doneWithQuestions");

        const allFinished = Array.from(room.playerQueues.values()).every(
            (q) => q.finished
        );

        if (allFinished) {
            console.log("===== GAME FINISHED =====");
            console.log("Room:", roomId);

            const answers = new Map<string, GameQuestion[]>();

            for (const [, pq] of room.playerQueues) {
                for (const entry of pq.questions) {
                    console.log({
                        question: entry.question,
                        answer: entry.answer,
                        answeredBy: room.users.get(entry.answeredByUserId)?.name,
                        aboutUser: room.users.get(entry.aboutUserId)?.name,
                    });
                    const currentAnswers = answers.get(entry.aboutUserId) || [];
                    currentAnswers.push(entry);
                    answers.set(entry.aboutUserId, currentAnswers);
                }
            }
            console.log(answers);
            io.to(roomId).emit("questionsFinished");
           const profiles = await getAiProfiles(answers,roomId);
           if(profiles){
               room.profiles = profiles;
               room.votingOrder = shuffle(Array.from(profiles.keys()));
               room.votingIndex = 0;
               room.finalScores = new Map();
               room.finalScores = new Map(
                   Array.from(room.users.keys()).map(id => [id, 0])
               );

               startNextVote(roomId);


           }else {
               io.to(roomId).emit("userProfilesError");
           }
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

const getAiProfiles = async (answers: Map<string, GameQuestion[]>, roomId: string) => {
    const profiles = new Map<string, string>();

    for (const [userId, questions] of answers) {
        let prompt = "Generate a Person Profile based on these questions and answers. The profile should be about 60 words for a person aged 18-30, but dont mention the age in the profile. Describe their traits and personality without directly using words from the answers or questions. Do not assume gender.\n\n";

        for (const question of questions) {
            prompt += `Question: ${question.question}\n`;
            prompt += `Answer: ${question.answer}\n\n`;
        }

        try {
            // Correct POST request to the text API
            const response = await fetch('https://text.pollinations.ai/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    messages: [
                        { role: "system", content: "You are a creative profile writer." },
                        { role: "user", content: prompt }
                    ],
                    model: "openai", // You can change this model[citation:7]
                    max_tokens: 60,  // Limit response length
                }),
            });

            if (response.ok) {
                const text =  await response.text();
                profiles.set(userId, text);
                console.log(`Profile for user ${userId}:`, text);

                if(profiles.size == activeRooms.get(roomId).users.size){
                    return profiles;
                }
            } else {
                console.error(`API error for user ${userId}:`, response);
                profiles.set(userId, "Firmly opinionated and cheerfully stubborn, they’ll champion an unlikely favorite from the natural world with missionary zeal. Warm-hearted, playful, and loyal, they bond fast and defend passions fiercely. Their confidence sometimes outruns caution, leading to impulsive decisions on late nights. Still, their enthusiasm is contagious, their humor easy, and their convictions worn proudly—especially anything that waddles.");
                // das später erstzen
                if(profiles.size == activeRooms.get(roomId).users.size){
                    return profiles;
                }            }
        } catch (error) {
            console.error(`Request failed for user ${userId}:`, error);
            profiles.set(userId, "Error connecting to AI service.");
            // das später erstzen
            if(profiles.size == activeRooms.get(roomId).users.size){
                return profiles;
            }
        }
    }
}
const startNextVote = (roomId: string) => {
    const room = activeRooms.get(roomId);
    if (!room) return;

    if (room.votingIndex >= room.votingOrder.length) {
        finishVoting(roomId);
        return;
    }

    const profileUserId = room.votingOrder[room.votingIndex];

    room.currentVote = {
        profileUserId,
        votes: new Map(),
    };

    io.to(roomId).emit("voteStarted", {
        profileUserId,
        profileText: room.profiles.get(profileUserId),
        index: room.votingIndex + 1,
        total: room.votingOrder.length,
        users: Array.from(room.users.entries()).map(([id, u]) => ({
            userId: id,
            name: u.name,
        })),
    });
};

const finishVoting = (roomId: string) => {
    const room = activeRooms.get(roomId);
    if (!room) return;

    console.log(room.finalScores);
    room.gameFinished = true;

    io.to(roomId).emit("votingFinished", {
        results: Array.from(room.finalScores.entries()).map(([id, score]) => ({
            userId: id,
            name: room.users.get(id)?.name,
            score,
        })),
    });
    room.currentVote = null;
};
const emitCurrentVotingState = (roomId: string, socket: any, userId: string) => {
    const room = activeRooms.get(roomId);
    if (!room || !room.currentVote) return;

    const profileUserId = room.currentVote.profileUserId;
    const hasVoted = room.currentVote.votes.has(userId);
    const votedFor = room.currentVote.votes.get(userId) ?? null;

    socket.emit("voteStarted", {
        profileUserId,
        profileText: room.profiles.get(profileUserId),
        index: room.votingIndex + 1,
        total: room.votingOrder.length,
        users: Array.from(room.users.entries()).map(([id, u]) => ({
            userId: id,
            name: u.name,
        })),
        hasVoted,
        votedFor
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
            profiles: new Map<string,string>(),
            votingIndex: 0,
            finalScores: new Map(),
            votingOrder: [],
            currentVote: null,
            gameFinished: false,
        });

        socket.emit("roomCreated", id);
    });

    /* ===== Join Room ===== */

    socket.on("joinRoom", ({roomId, name}) => {
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

        if(room.gameFinished){
            finishVoting(roomId);
        }
        if (room.currentVote) {
            emitCurrentVotingState(roomId, socket,userId);
        }

        socket.emit("joinedRoom", {
            roomId,
            name,
            isAdmin: room.users.get(userId)?.isAdmin,
            open: room.open,
        });

        broadcastRoomUsers(roomId, userId);
        sendNextQuestion(roomId, userId);
    });

    /* ===== Leave Room ===== */

    socket.on("leaveRoom", ({roomId}) => {
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

    socket.on("closeRoom", ({roomId}) => {
        const room = activeRooms.get(roomId);
        if (room && room.creatorId === userId) {
            io.to(roomId).emit("closedRoom");
            activeRooms.delete(roomId);
        }
    });

    /* =======================
       Game Logic
    ======================= */

    socket.on("startGame", ({roomId}) => {
        const room = activeRooms.get(roomId);
        if (!room || room.creatorId !== userId || room.users.size < 2) return;

        room.open = false;
        room.playerQueues.clear();

        const userIds = Array.from(room.users.keys());

        for (const answeredBy of userIds) {
            const questionsForPlayer: GameQuestion[] = [];

            for (const aboutUser of userIds) {
                if (answeredBy === aboutUser) continue;

                const qs = pickRandomQuestions(3);
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

    socket.on("answerQuestion", ({roomId, answer}) => {
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


    //vote logic

    socket.on("voteProfile", ({ roomId, guessedUserId }) => {
        const room = activeRooms.get(roomId);
        if (!room || !room.currentVote) return;


        if (room.currentVote.votes.has(userId)) return;

        room.currentVote.votes.set(userId, guessedUserId);
        socket.emit("votedProfile", {userId, guessedUserId});

        // alle haben gevotet?
        if (room.currentVote.votes.size === room.users.size) {
            const correctUserId = room.currentVote.profileUserId;
            for (const [voterId, guessedUserId] of room.currentVote.votes) {
                if (guessedUserId === correctUserId) {
                    room.finalScores.set(
                        voterId,
                        (room.finalScores.get(voterId) || 0) + 1
                    );
                }
            }

            room.votingIndex++;
            setTimeout(() => startNextVote(roomId), 100);
        }
    });


    // reset game stuff and make room reusable
    socket.on("cleanRoom", ({roomId}) => {
        const room = activeRooms.get(roomId);
        if (room && room.creatorId === userId) {
            room.gameFinished = false;
            room.playerQueues.clear();
            room.finalScores.clear();
            room.currentVote = null;
            room.profiles.clear();
            room.votingOrder = [];
            room.votingIndex = 0;
            room.open = true;
            io.to(roomId).emit("cleanedRoom", roomId);

        }
    });

});

/* =======================
   Start Server
======================= */

server.listen(3000, () => {
    console.log("server running at http://localhost:3000");
});
