<script setup lang="ts">
import {onMounted, ref} from "vue";
import {useConnectionStore} from "@/stores/connection.ts";
import router from "@/router";

const socket = useConnectionStore();
const roomId = ref("");
const name = ref("PenisLutscher");

onMounted(() => {
  if(socket.roomId){
    router.push("/"+socket.roomId);
  }
  console.log(socket.roomId);

})

function joinRoom (){
  if(roomId.value){
    socket.joinRoom(roomId.value, name.value);
  }
}
function createRoom (){
  socket.createRoom(name.value);
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