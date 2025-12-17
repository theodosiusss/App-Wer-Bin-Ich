import {defineStore} from "pinia";
import {socket} from "@/socket";
import router from "@/router";

export const useConnectionStore = defineStore("connection", {
    state: () => ({
        isConnected: false,
        roomId: "",
        name: "",
        isAdmin: false,
    }),

    actions: {

        mount() {
            // 1. LocalStorage lesen
            const storedRoomId = localStorage.getItem("roomId");
            const storedName = localStorage.getItem("name");

            if (storedRoomId && storedName) {
                this.roomId = storedRoomId;
                this.name = storedName;
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
                console.log(args);
                localStorage.setItem("roomId", this.roomId);
                localStorage.setItem("name", this.name);
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
            });

            socket.on("roomNotFound", () => {
                this.roomId = "";
                router.push("/");
                console.log("room not found");
            });
            socket.on("closedRoom", () => {
                this.roomId = "";
                this.isAdmin = false;
                localStorage.removeItem("roomId");

                window.location.reload();
            })
            socket.on("leftRoom", () => {
                this.roomId = "";
                this.isAdmin = false;
                localStorage.removeItem("roomId");
                router.push("/");
            })
        },

        /* ======================
           ACTIONS
           ====================== */

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

        }
    },
});
