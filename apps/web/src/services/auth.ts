import type { z } from 'zod';

import type {
  LoginInput,
  LoginResponse,
  RegisterInput,
  forgotPasswordSchema,
  resetPasswordSchema,
} from '@futcheck/shared';

import { api } from '@/services/http';

/**
 * Thin, typed wrappers over `/auth/*`.
 *
 * Nothing here touches the refresh token: it travels in an httpOnly cookie that
 * `api` sends automatically because of `withCredentials`.
 */

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

/** Deliberately generic — it never reveals whether the e-mail exists. */
export interface ForgotPasswordResponse {
  message: string;
}

export interface SuccessResponse {
  success: true;
}

export async function register(input: RegisterInput): Promise<LoginResponse> {
  const { data } = await api.post<LoginResponse>('/auth/register', input);
  return data;
}

export async function login(input: LoginInput): Promise<LoginResponse> {
  const { data } = await api.post<LoginResponse>('/auth/login', input);
  return data;
}

/** The body is empty on purpose: the refresh cookie is the credential. */
export async function refresh(): Promise<LoginResponse> {
  const { data } = await api.post<LoginResponse>('/auth/refresh');
  return data;
}

export async function logout(): Promise<SuccessResponse> {
  const { data } = await api.post<SuccessResponse>('/auth/logout');
  return data;
}

export async function forgotPassword(input: ForgotPasswordInput): Promise<ForgotPasswordResponse> {
  const { data } = await api.post<ForgotPasswordResponse>('/auth/forgot-password', input);
  return data;
}

export async function resetPassword(input: ResetPasswordInput): Promise<SuccessResponse> {
  const { data } = await api.post<SuccessResponse>('/auth/reset-password', input);
  return data;
}
