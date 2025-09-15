import { createRouter, createWebHashHistory } from 'vue-router';

const routes = [
  {
    path: '/',
    name: 'home',
    component: () => import('@/views/HomeView.vue'),
  },
  {
    path: '/gba-multi-menu',
    name: 'gba-multi-menu',
    component: () => import('@/views/GBAMultiMenuView.vue'),
  },
  {
    path: '/rom-assembly',
    name: 'rom-assembly',
    component: () => import('@/views/RomAssemblyView.vue'),
  },
];

const router = createRouter({
  history: createWebHashHistory(),
  routes,
});

export default router;
