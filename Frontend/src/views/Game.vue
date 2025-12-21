<script setup lang="ts">
import { useConnectionStore } from "@/stores/connection";
import {onMounted, ref} from "vue";
import {getUserId} from "@/socket.ts";
const socket = useConnectionStore();
const answer = ref("");
const props = defineProps({
  roomId : String
});
onMounted(() => {
  if(socket.roomId !== props.roomId) {
    if(props.roomId) {
      socket.name = "penischelckr"
      socket.joinRoom(props.roomId)
    }
  }
})
function submitAnswer() {
  if (!answer.value) return;
  socket.answerQuestion(answer.value);
  answer.value = "";
}
const userId = getUserId();

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
      <span v-if="user.userId === userId"> (You)</span>
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
  <div v-if="socket.gameIsStarted && !socket.currentQuestion && !socket.questionsFinished && socket.doneWithQuestions">
    <h2>You’re done 🎉 Waiting for others…</h2>
  </div>

  <div v-if="socket.questionsFinished && !socket.gameFinished && !socket.profilesError && !socket.votingActive">
    Generating Profiles
    <img src="https://media1.tenor.com/m/WX_LDjYUrMsAAAAC/loading.gif" alt="loading icon">
  </div>

  <div v-if="socket.profilesError">
    error generating Profiles
  </div>

  <div v-if="socket.votingActive && socket.currentProfile">
    <h2>
      Profile {{ socket.currentProfile.index }} / {{ socket.currentProfile.total }}
    </h2>

    <p>{{ socket.currentProfile.text }}</p>

    <button
        v-for="u in socket.votingUsers"
        :key="u.userId"
        @click="socket.vote(u.userId)"
    >
      {{ u.name }}
    </button>
  </div>

  <div v-if="socket.gameFinished">
    <h2>🏆 Scores</h2>

    <div v-for="r in socket.results" :key="r.userId">
      {{ r.name }} – {{ r.score }} Punkte
    </div>


    <button v-if="socket.isAdmin" @click="socket.cleanRoom">reset Room</button>
  </div>



  <!-- Finished -->
  <div v-if="socket.gameFinished">
    <h2>Game Finished 🎉</h2>
    <pre>{{ socket.results }}</pre>
  </div>
</template>
