<script setup lang="ts">


import {useConnectionStore} from "@/stores/connection.ts";
import {onMounted} from "vue";
import router from "@/router";

const props= defineProps({
  roomId: String,
})
const socket = useConnectionStore();

onMounted(() => {
  if(socket.roomId !== props.roomId) {
    if(props.roomId) {
      socket.joinRoom(props.roomId, "lenispecker")
    }
  }
})

</script>

<template>

</template>

<style scoped>

</style>