import {
  AxiosError,
  AxiosHeaders,
  type AxiosAdapter,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios';

import {
  BOOKING_STATUSES,
  ERROR_CODES,
  type CommunityMemberDto,
  type MeResponse,
  type PostDto,
  type SessionDetailDto,
  type SessionSummaryDto,
  type VenueDetailDto,
  type VenueSummaryDto,
} from '@futcheck/shared';

import rawFixtures from './fixtures.json';

/**
 * The whole backend, running in the browser.
 *
 * GitHub Pages serves static files and nothing else — no Node, no PostgreSQL — so
 * a published build has no API to talk to. This replaces the axios transport with
 * a small in-memory server over a snapshot of real API responses, which is what
 * lets a published link show the actual app instead of a screenshot of it.
 *
 * Only reachable when VITE_DEMO=true. The deployed product keeps talking to the
 * real API, and this file is never imported there.
 */

/** Marks the browser session as signed in, so a reload keeps the user inside. */
const SESSION_KEY = 'futcheck:demo:session';

interface Page<T> {
  data: T[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

interface Fixtures {
  me: MeResponse;
  venues: { data: VenueSummaryDto[] };
  community: Page<CommunityMemberDto>;
  feed: Page<PostDto>;
  bookings: { data: SessionSummaryDto[] };
  sessions: { data: SessionSummaryDto[] };
  sessionDetails: Record<string, SessionDetailDto>;
  venueDetails: Record<string, VenueDetailDto>;
}

/**
 * The snapshot stores image paths as `/static/...`, which on Pages points at the
 * domain root instead of this project's sub-path. The files ship under
 * `demo-static/`, so every such path is rewritten against the build's base.
 */
function rewriteAssetUrls<T>(value: T): T {
  const base = import.meta.env.BASE_URL;
  const json = JSON.stringify(value).replaceAll('"/static/', `"${base}demo-static/`);
  return JSON.parse(json) as T;
}

const fixtures = rewriteAssetUrls(rawFixtures as unknown as Fixtures);

/** Everything the demo can change lives here, so a reload starts clean. */
const state = {
  me: structuredClone(fixtures.me),
  posts: structuredClone(fixtures.feed.data),
  sessions: structuredClone(fixtures.sessions.data),
  sessionDetails: structuredClone(fixtures.sessionDetails),
};

// -----------------------------------------------------------------------------
// Replies
// -----------------------------------------------------------------------------

function ok<T>(config: InternalAxiosRequestConfig, data: T, status = 200): AxiosResponse<T> {
  return { data, status, statusText: 'OK', headers: new AxiosHeaders(), config };
}

function fail(
  config: InternalAxiosRequestConfig,
  status: number,
  code: string,
  message: string,
): AxiosError {
  const response = {
    data: { error: { code, message } },
    status,
    statusText: 'Error',
    headers: new AxiosHeaders(),
    config,
  } as AxiosResponse;

  return new AxiosError(message, String(status), config, null, response);
}

function currentSession(): { accessToken: string; user: MeResponse } {
  return { accessToken: 'demo-access-token', user: state.me };
}

function paginate<T>(items: T[], query: URLSearchParams): Page<T> {
  const page = Number(query.get('page') ?? 1);
  const limit = Number(query.get('limit') ?? 20);
  const start = (page - 1) * limit;

  return {
    data: items.slice(start, start + limit),
    meta: { page, limit, total: items.length, totalPages: Math.ceil(items.length / limit) || 1 },
  };
}

function body<T>(config: InternalAxiosRequestConfig): T | null {
  if (typeof config.data !== 'string') return null;
  return JSON.parse(config.data) as T;
}

// -----------------------------------------------------------------------------
// Behaviour
// -----------------------------------------------------------------------------

/** Mirrors the real seat rules closely enough that the screen tells the truth. */
function applyAnswer(detail: SessionDetailDto, response: 'VOU' | 'NAO_VOU'): SessionDetailDto {
  // Hand back whatever the previous answer was holding.
  if (detail.myBookingStatus === BOOKING_STATUSES.CONFIRMADA) {
    detail.confirmedCount -= 1;
    detail.availableSeats += 1;
  } else if (detail.myBookingStatus === BOOKING_STATUSES.LISTA_ESPERA) {
    detail.waitlistCount -= 1;
  }

  detail.myWaitlistPosition = null;

  if (response === 'NAO_VOU') {
    detail.myBookingStatus = BOOKING_STATUSES.NAO_VOU;
    return detail;
  }

  if (detail.availableSeats > 0) {
    detail.myBookingStatus = BOOKING_STATUSES.CONFIRMADA;
    detail.confirmedCount += 1;
    detail.availableSeats -= 1;
  } else {
    detail.myBookingStatus = BOOKING_STATUSES.LISTA_ESPERA;
    detail.waitlistCount += 1;
    detail.myWaitlistPosition = detail.waitlistCount;
  }

  return detail;
}

/** Keeps the agenda card in step with the detail screen. */
function syncSummary(detail: SessionDetailDto): void {
  const summary = state.sessions.find((item) => item.id === detail.id);
  if (!summary) return;

  summary.confirmedCount = detail.confirmedCount;
  summary.waitlistCount = detail.waitlistCount;
  summary.availableSeats = detail.availableSeats;
  summary.myBookingStatus = detail.myBookingStatus;
  summary.myWaitlistPosition = detail.myWaitlistPosition;
}

function detailFor(id: string): SessionDetailDto | null {
  const existing = state.sessionDetails[id];
  if (existing) return existing;

  // Sessions past the captured window still open, only without an attendee list.
  const summary = state.sessions.find((item) => item.id === id);
  if (!summary) return null;

  const sample = Object.values(state.sessionDetails)[0];

  const built: SessionDetailDto = {
    ...summary,
    attendees: [],
    rsvp: sample
      ? structuredClone(sample.rsvp)
      : {
          canAnswer: true,
          blockedReason: null,
          opensAt: summary.startsAt,
          changeDeadline: summary.startsAt,
        },
  };

  state.sessionDetails[id] = built;
  return built;
}

/** Shows the photo the user just picked, straight from the browser. */
async function readPhoto(data: unknown): Promise<{ url: string; width: number; height: number }> {
  const fallback = { url: `${import.meta.env.BASE_URL}icon.svg`, width: 1080, height: 1080 };
  if (!(data instanceof FormData)) return fallback;

  const file = data.get('image');
  if (!(file instanceof Blob)) return fallback;

  const url = URL.createObjectURL(file);

  const size = await new Promise<{ width: number; height: number }>((resolve) => {
    const probe = new Image();
    probe.onload = () => resolve({ width: probe.naturalWidth, height: probe.naturalHeight });
    probe.onerror = () => resolve({ width: 1080, height: 1080 });
    probe.src = url;
  });

  return { url, width: size.width, height: size.height };
}

// -----------------------------------------------------------------------------
// Routing
// -----------------------------------------------------------------------------

export const demoAdapter: AxiosAdapter = async (config) => {
  const method = (config.method ?? 'get').toUpperCase();
  const path = (config.url ?? '').split('?')[0] ?? '';

  const query = new URLSearchParams(
    Object.entries((config.params ?? {}) as Record<string, unknown>)
      .filter((entry): entry is [string, string | number] => entry[1] != null)
      .map(([key, value]) => [key, String(value)]),
  );

  // A touch of latency, so loading states show rather than being skipped over.
  await new Promise((resolve) => setTimeout(resolve, 180));

  const route = `${method} ${path}`;

  // --- auth ---
  if (route === 'POST /auth/login' || route === 'POST /auth/register') {
    sessionStorage.setItem(SESSION_KEY, '1');
    return ok(config, currentSession());
  }

  if (route === 'POST /auth/refresh') {
    if (sessionStorage.getItem(SESSION_KEY) !== '1') {
      throw fail(config, 401, ERROR_CODES.UNAUTHORIZED, 'Sessão encerrada.');
    }
    return ok(config, currentSession());
  }

  if (route === 'POST /auth/logout') {
    sessionStorage.removeItem(SESSION_KEY);
    return ok(config, { success: true });
  }

  if (route === 'POST /auth/forgot-password' || route === 'POST /auth/reset-password') {
    return ok(config, { success: true });
  }

  // --- me ---
  if (route === 'GET /me') return ok(config, state.me);

  if (route === 'PATCH /me') {
    Object.assign(state.me, body<Partial<MeResponse>>(config) ?? {});
    return ok(config, state.me);
  }

  if (route === 'PATCH /me/password') return ok(config, { success: true });

  if (route === 'PUT /me/avatar') {
    const photo = await readPhoto(config.data);
    state.me.avatarUrl = photo.url;
    state.me.avatarThumbnailUrl = photo.url;
    return ok(config, state.me);
  }

  if (route === 'DELETE /me/avatar') {
    state.me.avatarUrl = null;
    state.me.avatarThumbnailUrl = null;
    return ok(config, state.me);
  }

  if (route === 'GET /me/bookings') {
    const mine = state.sessions.filter(
      (item) =>
        item.myBookingStatus === BOOKING_STATUSES.CONFIRMADA ||
        item.myBookingStatus === BOOKING_STATUSES.LISTA_ESPERA,
    );
    return ok(config, { data: mine });
  }

  // --- sessions ---
  if (route === 'GET /sessions') {
    const from = query.get('from');
    const to = query.get('to');
    const type = query.get('type');
    const venueId = query.get('venueId');

    const matches = state.sessions.filter((item) => {
      if (from && item.startsAt < from) return false;
      if (to && item.startsAt > to) return false;
      if (type && item.type !== type) return false;
      if (venueId && item.venue.id !== venueId) return false;
      return true;
    });

    return ok(config, { data: matches });
  }

  const sessionDetail = /^\/sessions\/([^/]+)$/.exec(path);
  if (method === 'GET' && sessionDetail) {
    const detail = detailFor(decodeURIComponent(sessionDetail[1] ?? ''));
    if (!detail) throw fail(config, 404, ERROR_CODES.NOT_FOUND, 'Sessão não encontrada.');
    return ok(config, detail);
  }

  const rsvpRoute = /^\/sessions\/([^/]+)\/rsvp$/.exec(path);
  if (method === 'PUT' && rsvpRoute) {
    const detail = detailFor(decodeURIComponent(rsvpRoute[1] ?? ''));
    if (!detail) throw fail(config, 404, ERROR_CODES.NOT_FOUND, 'Sessão não encontrada.');

    const answer = body<{ response: 'VOU' | 'NAO_VOU' }>(config);
    if (!answer) throw fail(config, 422, ERROR_CODES.VALIDATION_ERROR, 'Resposta inválida.');

    const updated = applyAnswer(detail, answer.response);
    syncSummary(updated);
    return ok(config, updated);
  }

  // --- venues ---
  if (route === 'GET /venues') return ok(config, { data: fixtures.venues.data });

  const venueDetail = /^\/venues\/([^/]+)$/.exec(path);
  if (method === 'GET' && venueDetail) {
    const venue = fixtures.venueDetails[decodeURIComponent(venueDetail[1] ?? '')];
    if (!venue) throw fail(config, 404, ERROR_CODES.NOT_FOUND, 'CT não encontrado.');
    return ok(config, venue);
  }

  // --- community ---
  if (route === 'GET /community') {
    const term = (query.get('q') ?? '').trim().toLowerCase();
    const people = term
      ? fixtures.community.data.filter((person) => person.name.toLowerCase().includes(term))
      : fixtures.community.data;

    return ok(config, paginate(people, query));
  }

  // --- feed ---
  if (route === 'GET /feed') return ok(config, paginate(state.posts, query));

  if (route === 'POST /feed') {
    const photo = await readPhoto(config.data);
    const caption = config.data instanceof FormData ? config.data.get('caption') : null;

    const post: PostDto = {
      id: `demo-${String(Date.now())}`,
      author: {
        id: state.me.id,
        name: state.me.name,
        avatarUrl: state.me.avatarThumbnailUrl ?? state.me.avatarUrl,
      },
      venue: null,
      imageUrl: photo.url,
      thumbnailUrl: photo.url,
      width: photo.width,
      height: photo.height,
      caption: typeof caption === 'string' && caption.length > 0 ? caption : null,
      likeCount: 0,
      likedByMe: false,
      canDelete: true,
      createdAt: new Date().toISOString(),
    };

    state.posts.unshift(post);
    return ok(config, post, 201);
  }

  const likeRoute = /^\/feed\/([^/]+)\/like$/.exec(path);
  if (likeRoute && (method === 'PUT' || method === 'DELETE')) {
    const post = state.posts.find((item) => item.id === likeRoute[1]);
    if (!post) throw fail(config, 404, ERROR_CODES.NOT_FOUND, 'Publicação não encontrada.');

    const liked = method === 'PUT';
    if (liked !== post.likedByMe) {
      post.likedByMe = liked;
      post.likeCount += liked ? 1 : -1;
    }

    return ok(config, post);
  }

  const removeRoute = /^\/feed\/([^/]+)$/.exec(path);
  if (method === 'DELETE' && removeRoute) {
    state.posts = state.posts.filter((item) => item.id !== removeRoute[1]);
    return ok(config, { success: true });
  }

  throw fail(config, 404, ERROR_CODES.NOT_FOUND, `Sem resposta de demonstração para ${route}.`);
};
