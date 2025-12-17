<script setup lang="ts">
import {onBeforeUnmount, onMounted, onUnmounted} from "vue";
import {useConnectionStore} from "@/stores/connection.ts";

const socket = useConnectionStore();
onMounted(() => {
  socket.mount();
})

onBeforeUnmount(()=> {
  socket.unMount();
})
</script>

<template>
  <RouterView/>
</template>

<style scoped></style>
