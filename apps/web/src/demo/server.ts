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
  type AttendanceSheetDto,
  type CommunityMemberDto,
  type MeResponse,
  type PostDto,
  type ScheduleTemplateDto,
  type SessionDetailDto,
  type SessionSummaryDto,
  type StaffOverviewDto,
  type VenueDetailDto,
  type VenuePeopleDto,
  type VenueStaffDto,
  type VenueSummaryDto,
} from '@futcheck/shared';

import rawFixtures from './fixtures.json';
import { currentDemoRole, type DemoRole } from './roles.js';

/**
 * The whole backend, running in the browser.
 *
 * GitHub Pages serves static files and nothing else — no Node, no PostgreSQL —
 * so a published build has no API to talk to. This replaces the axios transport
 * with an in-memory server over a snapshot of real API responses, which is what
 * lets the published link show the actual app rather than a screenshot.
 *
 * The snapshot holds one view per kind of user, captured by logging in as each,
 * so the demo can show the player's app, the professor's panel, the owner's
 * panel and the network screens. Whatever a role could not reach was captured as
 * null, and this server answers 403 for exactly those — the permission model is
 * reproduced, not approximated.
 *
 * Only reachable when VITE_DEMO=true; the real build never imports this file.
 */

const SESSION_KEY = 'futcheck:demo:session';

interface Page<T> {
  data: T[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

interface RoleSnapshot {
  me: MeResponse;
  bookings: { data: SessionSummaryDto[] } | null;
  overview: StaffOverviewDto | null;
  sheets: Record<string, AttendanceSheetDto>;
  people: VenuePeopleDto | null;
  schedule: { data: ScheduleTemplateDto[] } | null;
  team: { data: VenueStaffDto[] } | null;
  venue: unknown | null;
  staffVenues: { data: unknown[] } | null;
  audit: Page<unknown> | null;
  settings: unknown | null;
  users: Page<unknown> | null;
}

interface Fixtures {
  venues: { data: VenueSummaryDto[] };
  community: Page<CommunityMemberDto>;
  feed: Page<PostDto>;
  sessions: { data: SessionSummaryDto[] };
  sessionDetails: Record<string, SessionDetailDto>;
  venueDetails: Record<string, VenueDetailDto>;
  roles: Record<DemoRole, RoleSnapshot>;
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

/** Everything the demo can change. Reset whenever the role changes. */
function freshState(role: DemoRole) {
  const snapshot = fixtures.roles[role];

  return {
    role,
    me: structuredClone(snapshot.me),
    posts: structuredClone(fixtures.feed.data),
    sessions: structuredClone(fixtures.sessions.data),
    sessionDetails: structuredClone(fixtures.sessionDetails),
    sheets: structuredClone(snapshot.sheets),
    schedule: structuredClone(snapshot.schedule?.data ?? []),
  };
}

let state = freshState(currentDemoRole());

export function reloadDemoState(): void {
  state = freshState(currentDemoRole());
}

function snapshot(): RoleSnapshot {
  return fixtures.roles[state.role];
}

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

/**
 * Anything this role could not reach when the snapshot was taken is refused the
 * same way the API refuses it, so the demo cannot show a screen the real product
 * would deny.
 */
function orForbidden<T>(config: InternalAxiosRequestConfig, value: T | null | undefined) {
  if (value == null) {
    throw fail(config, 403, ERROR_CODES.FORBIDDEN, 'Você não tem permissão para fazer isso.');
  }
  return ok(config, value);
}

function paginate<T>(items: T[], query: URLSearchParams): Page<T> {
  const page = Number(query.get('page') ?? 1);
  const limit = Number(query.get('limit') ?? query.get('pageSize') ?? 20);
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

/** Recounts a sheet after the user has marked people on it. */
function recount(sheet: AttendanceSheetDto): AttendanceSheetDto {
  const expected = sheet.entries.filter((e) => e.status !== BOOKING_STATUSES.LISTA_ESPERA);
  const present = expected.filter((e) => e.status === BOOKING_STATUSES.PRESENTE).length;
  const absent = expected.filter((e) => e.status === BOOKING_STATUSES.FALTOU).length;

  sheet.summary = {
    expected: expected.length,
    present,
    absent,
    pending: expected.length - present - absent,
  };

  return sheet;
}

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
  await new Promise((resolve) => setTimeout(resolve, 150));

  const route = `${method} ${path}`;
  const session = () => ({ accessToken: 'demo-access-token', user: state.me });

  // --- auth ---
  if (route === 'POST /auth/login' || route === 'POST /auth/register') {
    sessionStorage.setItem(SESSION_KEY, '1');
    reloadDemoState();
    return ok(config, session());
  }

  if (route === 'POST /auth/refresh') {
    if (sessionStorage.getItem(SESSION_KEY) !== '1') {
      throw fail(config, 401, ERROR_CODES.UNAUTHORIZED, 'Sessão encerrada.');
    }
    return ok(config, session());
  }

  if (route === 'POST /auth/logout') {
    sessionStorage.removeItem(SESSION_KEY);
    return ok(config, { success: true });
  }

  if (route === 'POST /auth/forgot-password') {
    return ok(config, { success: true, message: 'Se o e-mail existir, enviamos um link.' });
  }

  if (route === 'POST /auth/reset-password') return ok(config, { success: true });

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

  // --- venues, community, feed ---
  if (route === 'GET /venues') return ok(config, { data: fixtures.venues.data });

  const venueDetail = /^\/venues\/([^/]+)$/.exec(path);
  if (method === 'GET' && venueDetail) {
    const venue = fixtures.venueDetails[decodeURIComponent(venueDetail[1] ?? '')];
    if (!venue) throw fail(config, 404, ERROR_CODES.NOT_FOUND, 'CT não encontrado.');
    return ok(config, venue);
  }

  if (route === 'GET /community') {
    const term = (query.get('q') ?? '').trim().toLowerCase();
    const people = term
      ? fixtures.community.data.filter((person) => person.name.toLowerCase().includes(term))
      : fixtures.community.data;
    return ok(config, paginate(people, query));
  }

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

  // --- the staff panel ---
  if (route === 'GET /staff/overview') return orForbidden(config, snapshot().overview);
  if (route === 'GET /staff/venues') return orForbidden(config, snapshot().staffVenues);
  if (route === 'GET /staff/audit') return orForbidden(config, snapshot().audit);
  if (route === 'GET /staff/settings') return orForbidden(config, snapshot().settings);
  if (route === 'GET /staff/users') return orForbidden(config, snapshot().users);

  const venuePeople = /^\/staff\/venues\/[^/]+\/people$/.exec(path);
  if (method === 'GET' && venuePeople) return orForbidden(config, snapshot().people);

  const venueTeam = /^\/staff\/venues\/[^/]+\/staff$/.exec(path);
  if (method === 'GET' && venueTeam) return orForbidden(config, snapshot().team);

  const venueSchedule = /^\/staff\/venues\/[^/]+\/schedule$/.exec(path);
  if (method === 'GET' && venueSchedule) {
    if (!snapshot().schedule) {
      throw fail(config, 403, ERROR_CODES.FORBIDDEN, 'Você não tem permissão para fazer isso.');
    }
    return ok(config, { data: state.schedule });
  }

  const venueAdmin = /^\/staff\/venues\/[^/]+$/.exec(path);
  if (method === 'GET' && venueAdmin) return orForbidden(config, snapshot().venue);

  // --- the checklist ---
  if (route === 'GET /attendance/mine') {
    const overview = snapshot().overview;
    if (!overview) {
      throw fail(config, 403, ERROR_CODES.FORBIDDEN, 'Você não tem permissão para fazer isso.');
    }
    return ok(config, { data: overview.sessions });
  }

  const sheetRoute = /^\/attendance\/([^/]+)$/.exec(path);
  if (sheetRoute) {
    const id = decodeURIComponent(sheetRoute[1] ?? '');
    const sheet = state.sheets[id];

    if (!sheet) {
      throw fail(
        config,
        403,
        ERROR_CODES.FORBIDDEN,
        'Nesta demonstração só as sessões do painel têm lista.',
      );
    }

    if (method === 'GET') return ok(config, sheet);

    if (method === 'PATCH') {
      const marks = body<{ entries: Array<{ userId: string; status: string }> }>(config);

      for (const entry of marks?.entries ?? []) {
        const line = sheet.entries.find((item) => item.userId === entry.userId);
        if (!line) continue;

        line.status = entry.status as typeof line.status;
        line.checkedInAt =
          entry.status === BOOKING_STATUSES.CONFIRMADA ? null : new Date().toISOString();
      }

      return ok(config, recount(sheet));
    }
  }

  // Writes the demo does not pretend to do, answered honestly rather than with a
  // silent failure that would look like a bug.
  if (path.startsWith('/staff/') || path.startsWith('/attendance/')) {
    throw fail(
      config,
      403,
      ERROR_CODES.FORBIDDEN,
      'Esta demonstração é só de leitura. Rode o app localmente para alterar.',
    );
  }

  throw fail(config, 404, ERROR_CODES.NOT_FOUND, `Sem resposta de demonstração para ${route}.`);
};
