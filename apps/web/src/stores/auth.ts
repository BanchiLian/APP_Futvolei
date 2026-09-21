import { computed, ref } from 'vue';
import { defineStore } from 'pinia';

import {
  type MeResponse,
  type Permission,
  hasAllPermissions,
  hasAnyPermission,
  hasPermission,
} from '@futcheck/shared';

import { api, configureHttp } from '@/services/http';

/**
 * Session state.
 *
 * The access token is kept in memory only — never in localStorage, where any XSS
 * could read it. Continuity across reloads comes from the httpOnly refresh cookie
 * via `bootstrap()`.
 *
 * Permissions come from the server. They drive what the UI *shows*; the API is
 * what actually enforces them.
 */
export const useAuthStore = defineStore('auth', () => {
  const accessToken = ref<string | null>(null);
  const user = ref<MeResponse | null>(null);
  const isBootstrapping = ref(true);

  const isAuthenticated = computed(() => accessToken.value !== null && user.value !== null);
  const permissions = computed<Permission[]>(() => user.value?.permissions ?? []);

  function can(permission: Permission): boolean {
    return hasPermission(permissions.value, permission);
  }

  function canAll(required: Permission[]): boolean {
    return hasAllPermissions(permissions.value, required);
  }

  function canAny(required: Permission[]): boolean {
    return hasAnyPermission(permissions.value, required);
  }

  function setSession(token: string, profile: MeResponse): void {
    accessToken.value = token;
    user.value = profile;
  }

  function clearSession(): void {
    accessToken.value = null;
    user.value = null;
  }

  /** Exchanges the httpOnly refresh cookie for a fresh access token. */
  async function refreshAccessToken(): Promise<string> {
    const { data } = await api.post<{ accessToken: string; user: MeResponse }>('/auth/refresh');

    setSession(data.accessToken, data.user);
    return data.accessToken;
  }

  /**
   * Restores a session on page load. A failure here is the normal "not logged in"
   * path, not an error worth surfacing.
   */
  async function bootstrap(): Promise<void> {
    isBootstrapping.value = true;

    try {
      await refreshAccessToken();
    } catch {
      clearSession();
    } finally {
      isBootstrapping.value = false;
    }
  }

  async function logout(): Promise<void> {
    try {
      await api.post('/auth/logout');
    } finally {
      clearSession();
    }
  }

  // Wire the HTTP client: it asks the store for the token and for renewals.
  configureHttp({
    getAccessToken: () => accessToken.value,
    refreshAccessToken,
    onSessionExpired: clearSession,
  });

  return {
    accessToken,
    user,
    isBootstrapping,
    isAuthenticated,
    permissions,
    can,
    canAll,
    canAny,
    setSession,
    clearSession,
    refreshAccessToken,
    bootstrap,
    logout,
  };
});
