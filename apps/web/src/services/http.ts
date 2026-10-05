import axios, {
  AxiosError,
  type AxiosInstance,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from 'axios';

import { ERROR_CODES, type ApiErrorBody, type ErrorCode, errorMessageFor } from '@futcheck/shared';

/**
 * The single HTTP client.
 *
 * `withCredentials` is on because the refresh token lives in an httpOnly cookie —
 * the access token is the only thing JavaScript ever holds.
 *
 * The base URL falls back to the path the API is mounted on, because in the
 * deployed build the API serves this app from the same origin. Without the
 * fallback a build made without the variable set still succeeds and produces an
 * app whose every request silently goes to the wrong path.
 */
export const api: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '/api/v1',
  withCredentials: true,
  timeout: 15_000,
  headers: { 'Content-Type': 'application/json' },
});

/**
 * Hooks registered by the auth store. Keeping them here (instead of importing the
 * store) avoids a circular import between the client and the store that uses it.
 */
interface AuthHooks {
  getAccessToken: () => string | null;
  /** Must call `POST /auth/refresh` and return the new access token. */
  refreshAccessToken: () => Promise<string>;
  /** Called when refreshing is impossible: the session is over. */
  onSessionExpired: () => void;
}

let hooks: AuthHooks | null = null;

export function configureHttp(next: AuthHooks): void {
  hooks = next;
}

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = hooks?.getAccessToken();

  if (token) {
    config.headers.set('Authorization', `Bearer ${token}`);
  }

  return config;
});

/**
 * Automatic token renewal.
 *
 * A 401 triggers a single refresh; every other request that fails meanwhile waits
 * on the same promise instead of firing its own refresh (which would rotate the
 * refresh token several times and invalidate the session).
 */
let refreshInFlight: Promise<string> | null = null;

/** Marks a request we already retried, so a second 401 cannot loop forever. */
type RetriableConfig = AxiosRequestConfig & { _retried?: boolean };

api.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    if (!(error instanceof AxiosError) || !error.response) {
      return Promise.reject(error);
    }

    const config = error.config as RetriableConfig | undefined;
    const activeHooks = hooks;

    // Anything that is not a 401 on a normal endpoint is the caller's problem.
    // The auth endpoints are excluded: refreshing a failed refresh would loop.
    if (error.response.status !== 401 || isAuthEndpoint(config?.url)) {
      return Promise.reject(error);
    }

    // A 401 we cannot recover from: already retried, or no session machinery.
    if (!config || config._retried === true || !activeHooks) {
      activeHooks?.onSessionExpired();
      return Promise.reject(error);
    }

    config._retried = true;

    try {
      refreshInFlight ??= activeHooks.refreshAccessToken().finally(() => {
        refreshInFlight = null;
      });

      await refreshInFlight;
      return await api.request(config);
    } catch (refreshError) {
      activeHooks.onSessionExpired();
      return Promise.reject(refreshError);
    }
  },
);

function isAuthEndpoint(url: string | undefined): boolean {
  if (!url) return false;
  return ['/auth/refresh', '/auth/login', '/auth/logout'].some((path) => url.includes(path));
}

// -----------------------------------------------------------------------------
// Error helpers — the UI explains *why* something was refused (section 6).
// -----------------------------------------------------------------------------

export interface NormalizedApiError {
  code: ErrorCode;
  message: string;
  details?: unknown;
  status: number | null;
}

/** Turns anything thrown by axios into the shape the UI can render. */
export function normalizeApiError(error: unknown): NormalizedApiError {
  if (error instanceof AxiosError) {
    const body = error.response?.data as ApiErrorBody | undefined;

    if (body?.error) {
      return {
        code: body.error.code,
        message: body.error.message || errorMessageFor(body.error.code),
        details: body.error.details,
        status: error.response?.status ?? null,
      };
    }

    if (error.code === 'ECONNABORTED' || error.message === 'Network Error') {
      return {
        code: ERROR_CODES.INTERNAL_ERROR,
        message: 'Não foi possível falar com o servidor. Verifique sua conexão.',
        status: null,
      };
    }
  }

  return {
    code: ERROR_CODES.INTERNAL_ERROR,
    message: errorMessageFor(ERROR_CODES.INTERNAL_ERROR),
    status: null,
  };
}
