import { createRouter, createWebHashHistory, type RouteRecordRaw } from 'vue-router';

import { captureRouteError, recordBreadcrumb, setRouteTag } from '@/utils/monitoring/sentry-tracker';

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

router.afterEach((to, from) => {
  const routeName = String(to.name ?? to.path);
  setRouteTag(routeName);
  recordBreadcrumb('navigation', 'Route changed', {
    from: from.fullPath,
    to: to.fullPath,
    name: routeName,
  });
});

router.onError((error, to) => {
  const target = to ? String(to.name ?? to.fullPath) : undefined;
  recordBreadcrumb(
    'navigation',
    'Router navigation error',
    {
      target,
      error: error instanceof Error ? error.message : String(error),
    },
    'error',
  );
  captureRouteError(error, target);
});

export default router;
