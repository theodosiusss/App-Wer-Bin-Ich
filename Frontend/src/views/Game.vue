<script setup lang="ts">
import { useConnectionStore } from "@/stores/connection";
import {onMounted, ref} from "vue";

const socket = useConnectionStore();
const answer = ref("");
const props = defineProps({
  roomId : String
});
onMounted(() => {
  if(socket.roomId !== props.roomId) {
    if(props.roomId) {
      socket.joinRoom(props.roomId, "lenispecker")
    }
  }
})
function submitAnswer() {
  if (!answer.value) return;
  socket.answerQuestion(answer.value);
  answer.value = "";
}
</script>

<template>
  <!-- Room controls -->
  <button v-if="socket.isAdmin" @click="socket.closeRoom()">Close Room</button>
  <button v-else @click="socket.leaveRoom()">Leave Room</button>

  <!-- Users -->
  <div v-if="socket.users.length">
    <h2>Active Users</h2>
    <div v-for="user in socket.users" :key="user.userId">
      <span :style="{ color: user.online ? 'green' : 'gray' }">
        {{ user.name }}
      </span>
      <span v-if="user.isYou"> (You)</span>
      <span v-if="user.isAdmin"> (Owner)</span>
    </div>
  </div>

  <!-- Start game -->
  <button
      v-if="socket.isAdmin && !socket.gameIsStarted && socket.users.length > 1"
      @click="socket.startGame()"
  >
    Start Game
  </button>

  <!-- Question -->
  <div v-if="socket.currentQuestion">
    <h2>Question about {{ socket.currentQuestion.aboutUserName }}</h2>

    <p>{{ socket.currentQuestion.question }}</p>

    <input
        v-model="answer"
        placeholder="Your answer"
        @keyup.enter="submitAnswer"
    />
    <button @click="submitAnswer">Submit</button>
  </div>

  <!-- Waiting -->
  <div v-if="socket.gameIsStarted && !socket.currentQuestion && !socket.gameFinished">
    <h2>You’re done 🎉 Waiting for others…</h2>
  </div>


  <!-- Finished -->
  <div v-if="socket.gameFinished">
    <h2>Game Finished 🎉</h2>
    <pre>{{ socket.results }}</pre>
  </div>
</template>
