/**
 * The API error contract.
 *
 * Every failure travels as `{ error: { code, message, details } }`. The `code` is
 * stable and machine-readable so the web app can explain *why* an action was
 * refused ("prazo encerrado", "sessão lotada") instead of showing a generic error.
 */

import { IMAGE_UPLOAD, PASSWORD_MIN_LENGTH } from './schemas.js';

export const ERROR_CODES = {
  // --- generic ---
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  RATE_LIMITED: 'RATE_LIMITED',
  PAYLOAD_TOO_LARGE: 'PAYLOAD_TOO_LARGE',
  INTERNAL_ERROR: 'INTERNAL_ERROR',

  // --- auth ---
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  ACCOUNT_DISABLED: 'ACCOUNT_DISABLED',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  TOKEN_INVALID: 'TOKEN_INVALID',
  REFRESH_TOKEN_REUSED: 'REFRESH_TOKEN_REUSED',
  EMAIL_ALREADY_IN_USE: 'EMAIL_ALREADY_IN_USE',
  PASSWORD_TOO_WEAK: 'PASSWORD_TOO_WEAK',

  // --- super admin protection (section 4.1) ---
  SUPER_ADMIN_PROTECTED: 'SUPER_ADMIN_PROTECTED',
  SUPER_ADMIN_ALREADY_EXISTS: 'SUPER_ADMIN_ALREADY_EXISTS',
  ROLE_NOT_ASSIGNABLE: 'ROLE_NOT_ASSIGNABLE',

  // --- RSVP blocks (section 6): each one explains a different refusal ---
  RSVP_WINDOW_NOT_OPEN: 'RSVP_WINDOW_NOT_OPEN',
  RSVP_DEADLINE_PASSED: 'RSVP_DEADLINE_PASSED',
  RSVP_SESSION_IN_PAST: 'RSVP_SESSION_IN_PAST',
  RSVP_SESSION_CANCELLED: 'RSVP_SESSION_CANCELLED',
  RSVP_SESSION_TYPE_NOT_ALLOWED: 'RSVP_SESSION_TYPE_NOT_ALLOWED',
  RSVP_SESSION_FULL: 'RSVP_SESSION_FULL',

  // --- attendance ---
  ATTENDANCE_WINDOW_NOT_OPEN: 'ATTENDANCE_WINDOW_NOT_OPEN',
  ATTENDANCE_EDIT_DEADLINE_PASSED: 'ATTENDANCE_EDIT_DEADLINE_PASSED',
  ATTENDANCE_NOT_RESPONSIBLE: 'ATTENDANCE_NOT_RESPONSIBLE',
  SELF_CHECK_IN_DISABLED: 'SELF_CHECK_IN_DISABLED',

  // --- sessions / schedule ---
  SESSION_HAS_BOOKINGS: 'SESSION_HAS_BOOKINGS',
  SESSION_ALREADY_CANCELLED: 'SESSION_ALREADY_CANCELLED',
  CAPACITY_BELOW_CONFIRMED: 'CAPACITY_BELOW_CONFIRMED',
  SCHEDULE_RESPONSIBLE_REQUIRED: 'SCHEDULE_RESPONSIBLE_REQUIRED',

  // --- uploads ---
  UNSUPPORTED_FILE_TYPE: 'UNSUPPORTED_FILE_TYPE',
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

/** Wire format of a failed response. */
export interface ApiErrorBody {
  error: {
    code: ErrorCode;
    message: string;
    details?: unknown;
  };
}

/** Default pt-BR copy. The API may override `message` with something more specific. */
export const ERROR_MESSAGES_PT: Record<ErrorCode, string> = {
  VALIDATION_ERROR: 'Confira os campos destacados e tente de novo.',
  UNAUTHORIZED: 'Você precisa entrar para continuar.',
  FORBIDDEN: 'Você não tem permissão para fazer isso.',
  NOT_FOUND: 'Não encontramos o que você procura.',
  CONFLICT: 'Alguém alterou isso antes de você. Recarregue a tela e tente de novo.',
  RATE_LIMITED: 'Muitas tentativas. Aguarde um pouco e tente de novo.',
  PAYLOAD_TOO_LARGE: 'O conteúdo enviado passa do limite de 1 MB.',
  INTERNAL_ERROR: 'Algo deu errado do nosso lado. Tente novamente.',

  // "Acesso", never "sessão": in this app a sessão is a game, and telling someone
  // their sessões were ended reads as having lost their bookings.
  INVALID_CREDENTIALS: 'E-mail, usuário ou senha incorretos.',
  ACCOUNT_DISABLED: 'Esta conta está desativada. Fale com a administração.',
  TOKEN_EXPIRED: 'Seu acesso expirou. Entre novamente.',
  TOKEN_INVALID: 'Seu acesso é inválido. Entre novamente.',
  REFRESH_TOKEN_REUSED: 'Detectamos um problema de segurança no seu acesso. Entre novamente.',
  EMAIL_ALREADY_IN_USE: 'Este e-mail já está cadastrado.',
  PASSWORD_TOO_WEAK: `A senha precisa de no mínimo ${String(PASSWORD_MIN_LENGTH)} caracteres.`,

  SUPER_ADMIN_PROTECTED: 'Esta operação não é permitida. Fale com a administração.',
  SUPER_ADMIN_ALREADY_EXISTS: 'Já existe um super admin neste sistema.',
  ROLE_NOT_ASSIGNABLE: 'Este perfil de acesso não pode ser atribuído.',

  RSVP_WINDOW_NOT_OPEN: 'As respostas para esta sessão ainda não abriram.',
  RSVP_DEADLINE_PASSED: 'O prazo para alterar sua resposta já encerrou.',
  RSVP_SESSION_IN_PAST: 'Esta sessão já aconteceu.',
  RSVP_SESSION_CANCELLED: 'Esta sessão foi cancelada.',
  RSVP_SESSION_TYPE_NOT_ALLOWED: 'Você não participa deste tipo de sessão.',
  RSVP_SESSION_FULL: 'Esta sessão está lotada.',

  ATTENDANCE_WINDOW_NOT_OPEN: 'A lista de presença ainda não está liberada.',
  ATTENDANCE_EDIT_DEADLINE_PASSED: 'O prazo para editar a lista de presença encerrou.',
  ATTENDANCE_NOT_RESPONSIBLE: 'Você não é o responsável por esta sessão.',
  SELF_CHECK_IN_DISABLED: 'O check-in pelo aplicativo está desativado.',

  SESSION_HAS_BOOKINGS: 'Esta sessão já tem respostas. Cancele-a em vez de excluí-la.',
  SESSION_ALREADY_CANCELLED: 'Esta sessão já está cancelada.',
  CAPACITY_BELOW_CONFIRMED: 'A capacidade não pode ser menor que o número de confirmados.',
  SCHEDULE_RESPONSIBLE_REQUIRED: 'Toda aula precisa de um professor responsável.',

  UNSUPPORTED_FILE_TYPE: 'Formato de arquivo não suportado. Use JPEG, PNG ou WebP.',
  // Derived from the rule itself: the message said 5 MB while the API accepted 8.
  FILE_TOO_LARGE: `A imagem excede o tamanho máximo de ${String(
    IMAGE_UPLOAD.maxBytes / 1024 / 1024,
  )} MB.`,
};

export function errorMessageFor(code: ErrorCode): string {
  return ERROR_MESSAGES_PT[code];
}
