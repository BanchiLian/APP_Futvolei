import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';

import type { Permission } from '@futcheck/shared';

import { useAuthStore } from '@/stores/auth';

declare module 'vue-router' {
  interface RouteMeta {
    /** Reachable without a session. */
    public?: boolean;
    /** Permissions the user must hold to open the route. */
    permissions?: Permission[];
    title?: string;
  }
}

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'status',
    component: () => import('@/pages/StatusPage.vue'),
    meta: { public: true, title: 'FutCheck' },
  },

  {
    path: '/entrar',
    component: () => import('@/layouts/AuthLayout.vue'),
    meta: { public: true },
    children: [
      {
        path: '',
        name: 'login',
        component: () => import('@/pages/auth/LoginPage.vue'),
        meta: { public: true, title: 'Entrar' },
      },
    ],
  },

  {
    path: '/app',
    component: () => import('@/layouts/AppLayout.vue'),
    children: [
      {
        path: '',
        name: 'home',
        component: () => import('@/pages/app/HomePage.vue'),
        meta: { title: 'Início' },
      },
      {
        path: 'agenda',
        name: 'agenda',
        component: () => import('@/pages/app/AgendaPage.vue'),
        meta: { title: 'Agenda' },
      },
      {
        path: 'minhas-sessoes',
        name: 'my-sessions',
        component: () => import('@/pages/app/MySessionsPage.vue'),
        meta: { title: 'Minhas sessões' },
      },
      {
        path: 'perfil',
        name: 'profile',
        component: () => import('@/pages/app/ProfilePage.vue'),
        meta: { title: 'Perfil' },
      },
    ],
  },

  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: () => import('@/pages/NotFoundPage.vue'),
    meta: { public: true, title: 'Página não encontrada' },
  },
];

export const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior: (_to, _from, savedPosition) => savedPosition ?? { top: 0 },
});

/**
 * Route guard.
 *
 * Mirrors the API's `requirePermission`: it hides what the user cannot reach.
 * The server still refuses the underlying requests, so a tampered client gains
 * nothing.
 */
router.beforeEach(async (to) => {
  const auth = useAuthStore();

  // On a hard reload the refresh cookie may still yield a session.
  if (auth.isBootstrapping) {
    await auth.bootstrap();
  }

  if (to.meta.public) {
    return true;
  }

  if (!auth.isAuthenticated) {
    return { name: 'login', query: { redirect: to.fullPath } };
  }

  const required = to.meta.permissions ?? [];
  if (required.length > 0 && !auth.canAll(required)) {
    return { name: 'home' };
  }

  return true;
});

router.afterEach((to) => {
  const title = to.meta.title;
  document.title = title ? `${title} · FutCheck` : 'FutCheck';
});
