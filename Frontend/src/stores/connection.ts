import { defineStore } from "pinia";
import { socket } from "@/socket";

export const useConnectionStore = defineStore("connection", {
    state: () => ({
        isConnected: false,
        roomId: "",
    }),

    actions: {
        bindEvents() {
            socket.on("connect", () => {
                this.isConnected = true;
            });

            socket.on("disconnect", () => {
                this.isConnected = false;
            });
        },
        connect() {
            socket.connect();
        },
        disconnect() {
          socket.disconnect();
        },
        joinRoom(roomId: string) {
            socket.emit("joinRoom", roomId);
        },
        createRoom(roomId: string) {
            socket.emit("createRoom", roomId);
        },
    },
});