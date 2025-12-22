import {defineStore} from "pinia";
import {socket} from "@/socket";
import router from "@/router";
interface User {
    isAdmin: boolean,
    online: boolean,
    name: string
    userId: string
}
interface VoteUser {
    name: string
    userId: string
}
interface Profile{
    userId: string,
    description: string,
}

export const useConnectionStore = defineStore("connection", {
    state: () => ({
        isConnected: false,
        roomId: "",
        name: localStorage.getItem("name") || "",
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
        doneWithQuestions: false,
        questionsFinished: false,
        profilesError: false,
        votingActive: false,
        currentProfile: null as null | {
            text: string;
            index: number;
            total: number;
        },
        votedUserId: null,
        votingUsers: [] as VoteUser[],
        gameFinished: false,
        results: [] as any[],
    }),

    actions: {

        mount() {
            // 1. LocalStorage lesen
            const storedRoomId = localStorage.getItem("roomId");
            const storedName = localStorage.getItem("name");
            const storedGame = localStorage.getItem("gameIsStarted");
            const storedProfilesError = localStorage.getItem("profilesError");
            const storedQuestionsFinished = localStorage.getItem("questionsFinished");
            const storedGameFinished = localStorage.getItem("gameFinished");

            if (storedRoomId && storedName) {
                this.roomId = storedRoomId;
                this.name = storedName;
                this.gameIsStarted = storedGame == "true";
                this.profilesError = storedProfilesError == "true";
                this.questionsFinished = storedQuestionsFinished == "true";
                this.gameFinished = storedGameFinished == "true";
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
            localStorage.setItem("profilesError", ""+this.profilesError);
            localStorage.setItem("questionsFinished", ""+this.questionsFinished);
            localStorage.setItem("gameFinished", ""+this.gameFinished);


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
                this.reset();
                router.push("/");
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
            socket.on("doneWithQuestions", () => {
                this.currentQuestion = null;
                this.doneWithQuestions = true;
            })
            socket.on("questionsFinished", ()=>{
                this.questionsFinished = true;
                localStorage.setItem("questionsFinished", ""+this.questionsFinished);
            })
            socket.on("userProfilesError",()=>{
                this.profilesError= true;
                localStorage.setItem("profilesError", ""+this.profilesError);
                this.gameFinished = true;
                localStorage.setItem("gameFinished", ""+this.gameFinished);
                this.currentQuestion = null;

            })
            socket.on("voteStarted", (data) => {
                this.votingActive = true;
                this.currentProfile = {
                    text: data.profileText,
                    index: data.index,
                    total: data.total,
                };
                this.votingUsers = data.users;
                console.log(data.votedFor);
                this.votedUserId = data.votedFor;
            });
            socket.on("votedProfile", (data) => {
                this.votedUserId = data.guessedUserId;
            })

            socket.on("votingFinished", ({ results }) => {
                this.votingActive = false;
                this.gameFinished = true;
                localStorage.setItem("gameFinished", ""+this.gameFinished);
                this.results = results;
            });
            socket.on('cleanedRoom', (roomId) => {
                this.reset()
                this.joinRoom(roomId);
            })
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
            this.profilesError = false;
            this.questionsFinished = false;
            this.doneWithQuestions = false;

            localStorage.removeItem("roomId");
            localStorage.removeItem("gameIsStarted");
            localStorage.removeItem("profilesError");
            localStorage.removeItem("questionsFinished");
            localStorage.removeItem("gameFinished");

        },


        connect() {
            socket.connect();
        },

        disconnect() {
            socket.disconnect();
        },

        joinRoom(roomId: string) {
            this.roomId = roomId;

            socket.emit("joinRoom", {roomId, name: this.name});
        },

        createRoom() {
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
        vote(guessedUserId: string) {
            socket.emit("voteProfile", {
                roomId: this.roomId,
                guessedUserId,
            });
        },
        cleanRoom() {
            socket.emit("cleanRoom", {roomId: this.roomId});
        }

    },
});
