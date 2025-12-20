import {defineStore} from "pinia";
import {socket} from "@/socket";
import router from "@/router";
interface User {
    isAdmin: boolean,
    isYou: boolean,
    online: boolean,
    name: string
    userId: string
}

export const useConnectionStore = defineStore("connection", {
    state: () => ({
        isConnected: false,
        roomId: "",
        name: "",
        isAdmin: false,
        users: [] as User[],
        gameIsStarted: false,


        currentQuestion: null as null | {
            question: string
            aboutUserId: string
            aboutUserName: string
            answeredByUserId: string
            answeredByUserName: string
            index: number
        },
        gameFinished: false,
        results: [] as any[],
    }),

    actions: {

        mount() {
            // 1. LocalStorage lesen
            const storedRoomId = localStorage.getItem("roomId");
            const storedName = localStorage.getItem("name");
            const storedGame = localStorage.getItem("gameIsStarted");

            if (storedRoomId && storedName) {
                this.roomId = storedRoomId;
                this.name = storedName;
                this.gameIsStarted = storedGame == "true";
            }

            // 2. Events binden (nur einmal!)
            this.bindEvents();

            // 3. Socket verbinden
            if (!socket.connected) {
                socket.connect();
            }

            // 4. Reconnect / Rejoin
            if (this.roomId && this.name) {
                socket.emit("joinRoom", {
                    roomId: this.roomId,
                    name: this.name,
                });
            }
        },

        unMount() {
            // 1. Persistieren
            localStorage.setItem("roomId", this.roomId);
            localStorage.setItem("name", this.name);
            localStorage.setItem("gameIsStarted", ""+this.gameIsStarted);

            // 2. Listener entfernen
            socket.off("connect");
            socket.off("disconnect");
            socket.off("joinedRoom");
            socket.off("roomCreated");
            socket.off("roomUsers");
        },

        /* ======================
           SOCKET EVENTS
           ====================== */

        bindEvents() {
            socket.on("connect", () => {
                this.isConnected = true;
            });

            socket.on("disconnect", () => {
                this.isConnected = false;
            });

            socket.on("joinedRoom", (args) => {
                this.roomId = args.roomId;
                this.name = args.name;
                this.isAdmin = args.isAdmin;
                this.gameIsStarted = !args.open;
                console.log(args);
                localStorage.setItem("roomId", this.roomId);
                localStorage.setItem("name", this.name);
                localStorage.setItem("gameIsStarted", ""+this.gameIsStarted);
                router.push("/" + this.roomId);
            });

            socket.on("roomCreated", (roomId) => {
                socket.emit("joinRoom", {
                    roomId,
                    name: this.name,
                });
            });

            socket.on("roomUsers", (args) => {
                console.log(args);
                this.users = args.users;
                console.log(this.users);
            });

            socket.on("roomNotFound", () => {
                this.reset()
                router.push("/");
                console.log("room not found");
            });
            socket.on("roomNotOpen",()=>{
                this.reset()
                router.push("/");
                console.log("room not Open");
            });
            socket.on("closedRoom", () => {
                this.reset()
                window.location.reload();
            });
            socket.on("leftRoom", () => {
                this.reset()
                router.push("/");
            });
            socket.on("startedGame", (roomId) =>
            {
                console.log("startedGame", roomId);
                this.gameIsStarted = true;
                localStorage.setItem("gameIsStarted", ""+this.gameIsStarted);
            });
            socket.on("question", (payload) => {
                this.currentQuestion = payload;
            });

            socket.on("gameFinished", (results) => {
                console.log("Game finished", results);
                this.gameFinished = true;
                this.results = results;
                this.currentQuestion = null;
            });

        },

        /* ======================
           ACTIONS
           ====================== */
        reset() {
            this.roomId = "";
            this.gameIsStarted = false;
            this.isAdmin = false;
            this.currentQuestion = null;
            this.gameFinished = false;
            this.results = [];

            localStorage.removeItem("roomId");
            localStorage.removeItem("gameIsStarted");
        },


        connect() {
            socket.connect();
        },

        disconnect() {
            socket.disconnect();
        },

        joinRoom(roomId: string, name: string) {
            this.name = name;
            this.roomId = roomId;

            socket.emit("joinRoom", {roomId, name});
        },

        createRoom(name: string) {
            this.name = name;
            socket.emit("createRoom");
        },
        closeRoom() {
            const roomId = this.roomId;
            socket.emit("closeRoom", {roomId});
        },
        leaveRoom() {
            const roomId = this.roomId;
            socket.emit("leaveRoom", {roomId});
        },
        startGame() {
            socket.emit("startGame", {roomId: this.roomId});
        },
        answerQuestion(answer: string) {
            if (!this.roomId) return;

            socket.emit("answerQuestion", {
                roomId: this.roomId,
                answer,
            });

            this.currentQuestion = null;
        },
    },
});
