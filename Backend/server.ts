import express from 'express';
import {createServer} from 'node:http';
import {Server} from 'socket.io';
import cors from 'cors';
import * as trace_events from "node:trace_events";

const app = express();
const server = createServer(app);
const io = new Server(server, {
    cors: {
        origin: "http://localhost:5173", // Adjust this to your frontend URL
        methods: ["GET", "POST"],
        credentials: true
    }
});

type User = {
    name: string;
    socketId: string;
    online: boolean;
    isAdmin: boolean;
};

type RoomUsers = Map<string, User>;
const activeRooms = new Map<string, {users: RoomUsers, creatorId: string, open: boolean} >();

const broadcastRoomUsers = (roomId: string, userId?: string) => {
    const room = activeRooms.get(roomId);
    if (!room) return;

    const usersData = Array.from(room.users.entries()).map(([uid, user]) => ({
        userId: uid,
        name: user.name,
        online: user.online,
        isAdmin: user.isAdmin,
        isYou: uid === userId
    }));

    io.to(roomId).emit("roomUsers", {
        roomId,
        users: usersData
    });
};


app.get('/', (req, res) => {
    res.send('<h1>Hello Goon</h1>');
});
io.on('connection', (socket) => {
    const userId = socket.handshake.auth.userId;

    if (!userId) {
        console.log("No userId, disconnect");
        socket.disconnect();
        return;
    }
    console.log("connected:", userId, socket.id);



    // Rooms + socket + user handling (reconnects und so)
    socket.on('createRoom', () => {
        let id: string;
        while (true) {
            id = "";
            for (let i = 0; i < 6; i++) {
                id += Math.floor(Math.random() * 9);
            }
            if (!activeRooms.has(id)) {
                break;
            }
        }
        activeRooms.set(id, {users: new Map(), creatorId: userId, open: true});

        console.log("Room created:", id);
        socket.emit("roomCreated", id);


        console.log("room created mit id: " + id + " inhalte: " + activeRooms.get(id));
    });


    socket.on("joinRoom", ({ roomId, name }) => {
        let room = activeRooms.get(roomId);

        if (!room) {
            console.log("Room not found");
            socket.emit("roomNotFound");
            return;
        }
        const existing = room.users.get(userId);

        if(!room.open && !existing) {
            console.log("Room not Open at: " + roomId);
            socket.emit("roomNotOpen");
            return;
        }

        if (existing) {
            // 🔁 Rejoin
            existing.socketId = socket.id;
            existing.online = true;
            existing.name = name;
        } else {
            // 🆕 First join
            const isAdmin = room.creatorId === userId;
            room.users.set(userId, {
                name,
                socketId: socket.id,
                online: true,
                isAdmin: isAdmin,
            });
        }

        socket.join(roomId);
        socket.emit("joinedRoom", {
            roomId,
            name,
            isAdmin: room.users.get(userId).isAdmin,
            open: room.open
        });

        broadcastRoomUsers(roomId, userId);
    });



    socket.on("leaveRoom", ({roomId}) => {
        const room = activeRooms.get(roomId);
        console.log(roomId);
        if (!room) return;

        room.users.delete(userId);
        socket.leave(roomId);
        socket.emit("leftRoom");

        if (room.users.size === 0) {
            activeRooms.delete(roomId);
        } else {
            broadcastRoomUsers(roomId, userId);
        }

        console.log(`User ${userId} left room ${roomId}`);
    });
    socket.on("disconnect", (reason) => {
        console.log("disconnect", userId, socket.id, reason);

        for (const [roomId, room] of activeRooms) {
            const user = room.users.get(userId);
            if (!user) continue;

            if (user.socketId !== socket.id) continue;

            user.online = false;
            user.socketId = ""; // Use empty string instead of undefined for consistency

            console.log(`User ${userId} is now offline in room ${roomId}`);

            // Check if all users in this room are offline
            const allUsersOffline = Array.from(room.users.values()).every(user => !user.online);

            if (allUsersOffline) {
                console.log(`All users in room ${roomId} are offline`);

                setTimeout(() => {
                    const roomStillExists = activeRooms.get(roomId);
                    if (roomStillExists && Array.from(roomStillExists.users.values()).every(user => !user.online)) {
                        activeRooms.delete(roomId);
                        console.log(`Room ${roomId} deleted because all users are offline`);
                    }
                }, 5000);
            } else {
                broadcastRoomUsers(roomId, userId);

            }
        }
    });
    socket.on("closeRoom", ({roomId}) => {
        const room = activeRooms.get(roomId);

        if(room && room.creatorId === userId) {
            io.to(roomId).emit("closedRoom");
            activeRooms.delete(roomId);
            console.log("Room closed after close room");
        }

    });



    //Game Logik
    socket.on("startGame", ({roomId}) => {
        const room = activeRooms.get(roomId);
        console.log("game started");
        if(room && room.creatorId === userId) {
            room.open = false;
            io.to(roomId).emit("startedGame",roomId);
        }
    })





});

server.listen(3000, () => {
    console.log('server running at http://localhost:3000');
});
