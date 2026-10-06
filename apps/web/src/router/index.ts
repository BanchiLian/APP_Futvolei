import {
  createRouter,
  createWebHistory,
  type RouteComponent,
  type RouteRecordRaw,
} from 'vue-router';

import { PERMISSIONS, type Permission } from '@futcheck/shared';

import {
  type PageTransition,
  type TabName,
  rememberTab,
  saveScroll,
  savedScroll,
  setPageTitle,
  waitForPageEnter,
} from '@/router/navigation';
import { useAuthStore } from '@/stores/auth';

declare module 'vue-router' {
  interface RouteMeta {
    /** Reachable without a session. */
    public?: boolean;
    /** Permissions the user must hold to open the route. */
    permissions?: Permission[];
    title?: string;
    /** The bottom-bar tab this screen lives under. */
    tab?: TabName;
    /** 0 for a tab root, 1 for a screen pushed on top of it. Drives the transition. */
    depth?: number;
    /** Set by the router on every navigation; read by the layout's <Transition>. */
    transition?: PageTransition;
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
        meta: { title: 'Início', tab: 'home', depth: 0 },
      },
      {
        path: 'agenda',
        name: 'agenda',
        component: () => import('@/pages/app/AgendaPage.vue'),
        meta: { title: 'Agenda', tab: 'agenda', depth: 0 },
      },
      {
        path: 'cts',
        name: 'venues',
        component: () => import('@/pages/app/VenuesPage.vue'),
        meta: { title: 'CTs', tab: 'venues', depth: 0, permissions: [PERMISSIONS.VENUE_VIEW] },
      },
      {
        path: 'cts/:id',
        name: 'venue-detail',
        component: () => import('@/pages/app/VenueDetailPage.vue'),
        meta: { title: 'CT', tab: 'venues', depth: 1, permissions: [PERMISSIONS.VENUE_VIEW] },
      },
      {
        path: 'feed',
        name: 'feed',
        component: () => import('@/pages/app/FeedPage.vue'),
        meta: { title: 'Feed', tab: 'feed', depth: 0, permissions: [PERMISSIONS.FEED_VIEW] },
      },
      {
        // Reached from the feed, so it keeps that tab highlighted while open.
        path: 'comunidade',
        name: 'community',
        component: () => import('@/pages/app/CommunityPage.vue'),
        meta: {
          title: 'Pessoas',
          tab: 'feed',
          depth: 1,
          permissions: [PERMISSIONS.COMMUNITY_VIEW],
        },
      },
      {
        path: 'perfil',
        name: 'profile',
        component: () => import('@/pages/app/ProfilePage.vue'),
        meta: { title: 'Perfil', tab: 'profile', depth: 0 },
      },
      {
        // Opened from any tab, so it has no tab of its own: the bar keeps showing
        // the tab the user came from.
        path: 'sessoes/:id',
        name: 'session-detail',
        component: () => import('@/pages/app/SessionDetailPage.vue'),
        meta: { title: 'Sessão', depth: 1 },
      },
      // "Minhas sessões" now lives inside the profile tab; old links still land.
      { path: 'minhas-sessoes', redirect: { name: 'profile', hash: '#minhas-sessoes' } },
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
  // The build base, so the same bundle works at the domain root and under a
  // project sub-path such as /APP_Futvolei/ on GitHub Pages.
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
  async scrollBehavior(to, from, savedPosition) {
    if (to.path === from.path) return false;

    // Back/forward uses the browser's memory; switching to a tab uses ours, so
    // each tab keeps its own place like a native tab bar.
    const tabTop = (to.meta.depth ?? 0) === 0 ? savedScroll(to.fullPath) : undefined;
    const top = savedPosition?.top ?? tabTop ?? 0;

    await waitForPageEnter();
    return { top };
  },
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

router.beforeEach((_to, from) => {
  if (from.matched.length > 0) saveScroll(from.fullPath);
});

router.afterEach((to, from) => {
  const toDepth = to.meta.depth ?? 0;
  const fromDepth = from.meta.depth ?? 0;
  to.meta.transition = toDepth > fromDepth ? 'push' : toDepth < fromDepth ? 'pop' : 'tab';

  rememberTab(to.meta.tab);
  setPageTitle(null);

  const title = to.meta.title;
  document.title = title ? `${title} · FutCheck` : 'FutCheck';
});
