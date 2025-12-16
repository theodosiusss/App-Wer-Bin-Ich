<script setup lang="ts">
import {onMounted, ref} from "vue";
import {useConnectionStore} from "@/stores/connection.ts";
import router from "@/router";

const socket = useConnectionStore();
const roomId = ref("");

onMounted(() => {
  socket.bindEvents();
  socket.connect();
  if(socket.roomId){
    router.push("/"+socket.roomId);
  }
  console.log(socket.roomId);

})

function joinRoom (){
  if(roomId.value){
    socket.roomId = roomId.value;
    router.push("/"+roomId.value)
  }
}
function createRoom (){
  router.push("/"+"6767");
}
</script>

<template>
  <h1>Wer bin ich sigma!!</h1>

  <div>
    <h2>Neuen Raum erstellen</h2>
    <button @click="createRoom">Erstellen</button>
  </div>
  <div>
    <h2>Raum beitreten</h2>
    <input placeholder="raum id" type="text" v-model="roomId">
    <button @click="joinRoom">Beitreten</button>
  </div>

</template>

<style scoped>

</style>