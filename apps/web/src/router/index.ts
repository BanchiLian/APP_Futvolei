import {
  createRouter,
  createWebHistory,
  type RouteComponent,
  type RouteRecordRaw,
} from 'vue-router';

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

const AuthLayout = () => import('@/layouts/AuthLayout.vue');

/**
 * Wraps one public auth screen in the auth layout.
 *
 * Each screen gets its own top-level record instead of sharing a parent at `/`,
 * which would collide with the landing page and make matching order-dependent.
 */
function authRoute(
  path: string,
  name: string,
  title: string,
  component: () => Promise<RouteComponent>,
): RouteRecordRaw {
  return {
    path,
    component: AuthLayout,
    meta: { public: true },
    children: [{ path: '', name, component, meta: { public: true, title } }],
  };
}

const routes: RouteRecordRaw[] = [
  // The root has no screen of its own: the guard sends a visitor to the login
  // and a signed-in user straight into the app.
  { path: '/', redirect: { name: 'home' } },

  authRoute('/entrar', 'login', 'Entrar', () => import('@/pages/auth/LoginPage.vue')),
  authRoute(
    '/criar-conta',
    'register',
    'Criar conta',
    () => import('@/pages/auth/RegisterPage.vue'),
  ),
  authRoute(
    '/esqueci-minha-senha',
    'forgot-password',
    'Esqueci minha senha',
    () => import('@/pages/auth/ForgotPasswordPage.vue'),
  ),
  // The path the API builds into the password reset link.
  authRoute(
    '/redefinir-senha',
    'reset-password',
    'Criar nova senha',
    () => import('@/pages/auth/ResetPasswordPage.vue'),
  ),

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

  // An authenticated user has no business on the login or sign-up screens.
  if (auth.isAuthenticated && ['login', 'register'].includes(String(to.name))) {
    return { name: 'home' };
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
