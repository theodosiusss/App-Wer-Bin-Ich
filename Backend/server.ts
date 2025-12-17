import express from 'express';
import {createServer} from 'node:http';
import {Server} from 'socket.io';
import cors from 'cors';

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
};

type RoomUsers = Map<string, User>;
const activeRooms = new Map<string, RoomUsers>();

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
        activeRooms.set(id, new Map());

        console.log("Room created:", id);
        socket.emit("roomCreated", id);


        console.log("room created mit id: " + id + " inhalte: " + activeRooms.get(id));
    });


    socket.on("joinRoom", ({ roomId, name }) => {
        let room = activeRooms.get(roomId);

        if (!room) {
            console.log("Room not found");
            return;
        }

        const existing = room.get(userId);

        if (existing) {
            // 🔁 Rejoin
            existing.socketId = socket.id;
            existing.online = true;
            existing.name = name;
        } else {
            // 🆕 First join
            room.set(userId, {
                name,
                socketId: socket.id,
                online: true,
            });
        }

        socket.join(roomId);
        socket.emit("joinedRoom", {
            roomId,
            name,
        });

        io.to(roomId).emit("roomUsers", {
            roomId,
            users: [...room.entries()].map(([uid, u]) => ({
                userId: uid,
                name: u.name,
                online: u.online,
            })),
        });
    });



    socket.on("leaveRoom", (roomId) => {
        const room = activeRooms.get(roomId);
        if (!room) return;

        room.delete(userId);
        socket.leave(roomId);

        if (room.size === 0) {
            activeRooms.delete(roomId);
        } else {
            io.to(roomId).emit("roomUsers", {
                roomId,
                users: Array.from(room.entries()).map(([userId, user]) => ({
                    userId,
                    name: user.name,
                })),
            });
        }

        console.log(`User ${userId} left room ${roomId}`);
    });
    socket.on("disconnect", (reason) => {
        console.log("disconnect", userId, socket.id, reason);

        for (const [, room] of activeRooms) {
            const user = room.get(userId);
            if (!user) continue;

            if (user.socketId !== socket.id) continue;

            user.online = false;
            user.socketId = undefined;

            console.log(`User ${userId} ist jetzt offline`);
        }
    });



});

server.listen(3000, () => {
    console.log('server running at http://localhost:3000');
});
