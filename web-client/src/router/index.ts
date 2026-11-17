import { createRouter, createWebHashHistory, type RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'home',
    component: () => import('@/views/HomeView.vue'),
  },
  {
    path: '/rom-tools/:tab(split-merge|multi-menu)?',
    name: 'rom-tools',
    component: () => import('@/views/RomToolsView.vue'),
  },
  {
    path: '/rom-tools/split',
    redirect: to => ({ name: 'rom-tools', params: { tab: 'split-merge' }, query: to.query }),
  },
  {
    path: '/rom-tools/merge',
    redirect: to => ({ name: 'rom-tools', params: { tab: 'split-merge' }, query: to.query }),
  },
  {
    path: '/gba-multi-menu',
    name: 'gba-multi-menu',
    redirect: to => ({ name: 'rom-tools', params: { tab: 'multi-menu' }, query: to.query }),
  },
  {
    path: '/rom-assembly',
    name: 'rom-assembly',
    redirect: to => ({ name: 'rom-tools', params: { tab: 'split-merge' }, query: to.query }),
  },
];

const router = createRouter({
  history: createWebHashHistory(),
  routes,
});

export default router;
