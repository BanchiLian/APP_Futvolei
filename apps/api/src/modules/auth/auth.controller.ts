import type { CookieOptions, Request, Response } from 'express';

import type { LoginInput, RegisterInput } from '@futcheck/shared';

import { env } from '../../config/env.js';
import { auditContextFrom } from '../../lib/audit.js';
import * as service from './auth.service.js';

/**
 * HTTP only. Every rule lives in the service; this file moves data and manages
 * the refresh cookie.
 */

/**
 * The cookie is scoped to the auth routes, the only ones that read it. A narrower
 * path means the refresh token is not attached to every other API call, so it
 * cannot leak through an unrelated endpoint or a proxy log.
 */
const REFRESH_COOKIE_PATH = '/api/v1/auth';

function refreshCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: env.COOKIE_SAME_SITE,
    path: REFRESH_COOKIE_PATH,
    ...(env.COOKIE_DOMAIN ? { domain: env.COOKIE_DOMAIN } : {}),
  };
}

export function setRefreshCookie(res: Response, token: string): void {
  res.cookie(env.REFRESH_TOKEN_COOKIE_NAME, token, {
    ...refreshCookieOptions(),
    maxAge: env.REFRESH_TOKEN_TTL_DAYS * 86_400_000,
  });
}

function clearRefreshCookie(res: Response): void {
  // Must match the options the cookie was set with, or the browser keeps it.
  res.clearCookie(env.REFRESH_TOKEN_COOKIE_NAME, refreshCookieOptions());
}

function readRefreshCookie(req: Request): string | undefined {
  const value = req.cookies?.[env.REFRESH_TOKEN_COOKIE_NAME];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

/** The refresh token goes to the cookie and never into the response body. */
function sessionBody(session: service.IssuedSession) {
  return {
    accessToken: session.accessToken,
    expiresIn: session.expiresIn,
    user: session.user,
  };
}

export async function register(req: Request, res: Response): Promise<void> {
  const session = await service.register(req.body as RegisterInput, auditContextFrom(req));

  setRefreshCookie(res, session.refreshToken);
  res.status(201).json(sessionBody(session));
}

export async function login(req: Request, res: Response): Promise<void> {
  const session = await service.login(req.body as LoginInput, auditContextFrom(req));

  setRefreshCookie(res, session.refreshToken);
  res.json(sessionBody(session));
}

export async function refresh(req: Request, res: Response): Promise<void> {
  try {
    const session = await service.refresh(readRefreshCookie(req), auditContextFrom(req));

    setRefreshCookie(res, session.refreshToken);
    res.json(sessionBody(session));
  } catch (error) {
    // A refresh that fails leaves a useless cookie behind; drop it so the client
    // stops retrying with a token that will never work again.
    clearRefreshCookie(res);
    throw error;
  }
}

export async function logout(req: Request, res: Response): Promise<void> {
  await service.logout(readRefreshCookie(req), auditContextFrom(req));

  clearRefreshCookie(res);
  res.json({ success: true });
}

export async function forgotPassword(req: Request, res: Response): Promise<void> {
  const { email } = req.body as { email: string };

  await service.forgotPassword(email, auditContextFrom(req));

  // Always the same answer, whether or not the account exists.
  res.status(202).json({
    message: 'Se existir uma conta com este e-mail, enviamos um link para redefinir a senha.',
  });
}

export async function resetPassword(req: Request, res: Response): Promise<void> {
  const body = req.body as { token: string; password: string };

  await service.resetPassword(body, auditContextFrom(req));

  clearRefreshCookie(res);
  res.json({ success: true });
}
