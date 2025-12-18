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
  <button v-if="socket.isAdmin" @click="socket.closeRoom()">Close Room</button>
  <button v-else @click="socket.leaveRoom()">Leave Room                                                                            </button>

  <div v-if="socket.users.length > 0">
    <h2> Active Users: </h2>
    <div v-for="user in socket.users" :key="user.userId">
     <div :class="user.online ? 'user-online' : 'user-offline'">
       {{user.name}}
     </div>
      <span v-if="user.isYou">You</span>
      <span v-if="user.isAdmin">Owner</span>
    </div>

  </div>

</template>

<style scoped>

.user-online {
  color: red;
}
.user-offline {
  color: blue;
}
</style>