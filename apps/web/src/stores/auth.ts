import { computed, ref } from 'vue';
import { defineStore } from 'pinia';

import {
  type LoginInput,
  type MeResponse,
  type Permission,
  type RegisterInput,
  hasAllPermissions,
  hasAnyPermission,
  hasPermission,
} from '@futcheck/shared';

import * as authApi from '@/services/auth';
import { configureHttp } from '@/services/http';

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
    const session = await authApi.refresh();

    setSession(session.accessToken, session.user);
    return session.accessToken;
  }

  async function login(input: LoginInput): Promise<void> {
    const session = await authApi.login(input);
    setSession(session.accessToken, session.user);
  }

  /**
   * Public sign-up. The server decides the role — the client has no say and sends
   * no such field.
   */
  async function register(input: RegisterInput): Promise<void> {
    const session = await authApi.register(input);
    setSession(session.accessToken, session.user);
  }

  /** Resolves the same way whether or not the account exists, by design. */
  async function forgotPassword(email: string): Promise<string> {
    const { message } = await authApi.forgotPassword({ email });
    return message;
  }

  /**
   * After a reset the server has revoked every session, so there is nothing local
   * left to trust either.
   */
  async function resetPassword(input: { token: string; password: string }): Promise<void> {
    await authApi.resetPassword(input);
    clearSession();
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
      await authApi.logout();
    } finally {
      // Drop the local session even if the server call failed: the user asked to
      // leave, and the refresh cookie expires on its own.
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
    login,
    register,
    forgotPassword,
    resetPassword,
    logout,
  };
});
