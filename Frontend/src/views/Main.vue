<script setup lang="ts">
import {onMounted, ref} from "vue";
import {useConnectionStore} from "@/stores/connection.ts";
import router from "@/router";

const socket = useConnectionStore();
const roomId = ref("");

onMounted(() => {
  if (socket.roomId) {
    router.push("/" + socket.roomId);
    console.log(socket.roomId);
  }

})

function joinRoom() {
  if (!socket.name) {
    socket.name = "schlenispecker";
  }
    if (roomId.value) {
      socket.joinRoom(roomId.value);
    }


}

function createRoom() {
  if (!socket.name) {
    // fetch("https://usernameapiv1.vercel.app/api/random-usernames").then(res => res.json()).then(data => {
    //   name.value = data.usernames[0];
    //   if (name.value) {
    //     socket.createRoom(name.value);
    //   }
    // }).catch(error => console.log(error));
    socket.name = "schlenispecker";


  }
    socket.createRoom();


}
</script>

<template>
  <h1>Who am I </h1>

  <div>
    <h2>
      Enter A Name
    </h2>
    <input v-model="socket.name" type="text" required placeholder="your name"/>
  </div>
  <div>
    <h2>Create New Room</h2>
    <button @click="createRoom">Create</button>
  </div>
  <div>
    <h2>Join Room</h2>
    <input placeholder="room id " type="text" v-model="roomId">
    <button @click="joinRoom">Join</button>
  </div>

</template>

<style scoped>

</style>