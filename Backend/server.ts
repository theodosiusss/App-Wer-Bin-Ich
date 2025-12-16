import express from 'express';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
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

const activeRooms = new Map();

app.get('/', (req, res) => {
    res.send('<h1>Hello Goon</h1>');
});
io.on('connection', (socket) => {
    console.log('a user connected');
});

server.listen(3000, () => {
    console.log('server running at http://localhost:3000');
});
