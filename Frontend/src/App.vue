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

<style>
:root {
  --primary: #6366f1;
  --primary-hover: #4f46e5;
  --bg-dark: #0f172a;
  --bg-card: #1e293b;
  --text-main: #f8fafc;
  --text-muted: #94a3b8;
  --border: #334155;
  --error: #ef4444;
}

body {
  margin: 0;
  font-family: 'Inter', system-ui, -apple-system, sans-serif;
  background-color: var(--bg-dark);
  color: var(--text-main);
  display: flex;
  justify-content: center;
  min-height: 100vh;
}

#app {
  width: 100%;
  max-width: 500px;
  padding: 2rem;
}

h1, h2, h3 {
  font-weight: 700;
  letter-spacing: -0.025em;
}

h1 {
  text-align: center;
  font-size: 2.5rem;
  margin-bottom: 2rem;
  background: linear-gradient(to right, #818cf8, #c084fc);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

/* Inputs & Buttons */
input {
  width: 100%;
  padding: 0.75rem 1rem;
  margin: 0.5rem 0 1rem;
  background: var(--bg-dark);
  border: 1px solid var(--border);
  border-radius: 8px;
  color: white;
  font-size: 1rem;
  box-sizing: border-box;
  transition: border-color 0.2s;
}

input:focus {
  outline: none;
  border-color: var(--primary);
  ring: 2px solid var(--primary);
}

button {
  width: 100%;
  background-color: var(--primary);
  color: white;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  margin-bottom: 0.5rem;
}

button:hover {
  background-color: var(--primary-hover);
  transform: translateY(-1px);
}

button:active {
  transform: translateY(0px);
}

button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
