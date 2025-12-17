<script setup lang="ts">
import {onBeforeMount, onBeforeUnmount, onMounted, onUnmounted} from "vue";
import {useConnectionStore} from "@/stores/connection.ts";

const socket = useConnectionStore();
onBeforeMount(() => {
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
