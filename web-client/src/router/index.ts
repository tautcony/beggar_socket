import { createRouter, createWebHashHistory } from 'vue-router';

const routes = [
  {
    path: '/',
    name: 'home',
    // 使用路由级别的代码分割
    // 生成一个单独的 chunk (Home.[hash].js) 用于此路由
    // 仅当路由被访问时才被延迟加载
    component: () => import('@/views/HomeView.vue'),
  },
  {
    path: '/serial-test',
    name: 'serial-test',
    component: () => import('@/views/SerialTestView.vue'),
  },
];

const router = createRouter({
  history: createWebHashHistory(),
  routes,
});

export default router;
