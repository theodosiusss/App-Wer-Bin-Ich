import { createRouter, createWebHistory } from 'vue-router'
import Main from "@/views/Main.vue";
import Game from "@/views/Game.vue";

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
      {
          path: '/',
          name: 'home',
          component: Main,
      },
      {
          path: '/:roomId',
          name: 'game',
          component: Game,
          props: true,
      },
  ],
})

export default router
