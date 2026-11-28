/**
 * One error shape for the whole app (plan §7.7, §9.1; CLAUDE.md rule 6).
 * Every Supabase / PostgREST / Auth / Edge Function error goes through toAppError().
 *
 * This module is dependency-free on purpose: it duck-types Supabase errors so it
 * doesn't import @supabase/supabase-js (CLAUDE.md rule 10).
 */

/** Generic codes from plan §9.1. */
export const GENERAL_ERROR_CODES = [
  'VALIDATION_ERROR',
  'UNAUTHENTICATED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'VERSION_MISMATCH',
  'PROJECT_ARCHIVED',
  'RATE_LIMITED',
  'INTERNAL_ERROR',
] as const;

/**
 * Business codes raised by RPCs with `raise exception 'CODE' using errcode = 'P0001'` (plan §9.4–9.11).
 * When an RPC adds a code, add it here. Unknown codes become INTERNAL_ERROR (and are kept in details).
 */
export const BUSINESS_ERROR_CODES = [
  // workspace (§9.4–9.5)
  'NOT_WORKSPACE_MEMBER',
  'CANNOT_REMOVE_OWNER',
  'CANNOT_CHANGE_OWNER',
  'OWNER_CANNOT_LEAVE',
  'OWNS_WORKSPACE',
  'TARGET_NOT_ADMIN',
  'CONFIRMATION_MISMATCH',
  'ONLY_OWNER_CAN_INVITE_ADMIN',
  'ALREADY_MEMBER_OR_INVITED',
  'INVITATION_EXPIRED',
  'NOT_PENDING',
  'EMAIL_MISMATCH',
  // project (§9.6–9.7)
  'PROJECT_NAME_TAKEN',
  'PROJECT_KEY_TAKEN',
  'ALREADY_ARCHIVED',
  'LAST_PROJECT_MANAGER',
  'MAX_STATUSES',
  'STATUS_IN_USE',
  'CATEGORY_REQUIRED',
  // task (§9.8)
  'INVALID_STATUS',
  'INVALID_ASSIGNEE',
  'QUERY_TOO_SHORT',
] as const;

export type GeneralErrorCode = (typeof GENERAL_ERROR_CODES)[number];
export type BusinessErrorCode = (typeof BUSINESS_ERROR_CODES)[number];
export type AppErrorCode = GeneralErrorCode | BusinessErrorCode;

export interface AppErrorDetails {
  /** Original error code (Postgres SQLSTATE, PostgREST PGRSTxxx, Auth code) for logs. */
  sourceCode?: string;
  /** HTTP status, when known. */
  status?: number;
  /** A P0001 code the frontend doesn't know yet. */
  unknownCode?: string;
  /** Free-form details from the server (PostgREST `details`, Edge Function `details`). */
  info?: unknown;
}

export class AppError extends Error {
  override readonly name = 'AppError';
  readonly code: AppErrorCode;
  readonly details: AppErrorDetails;

  constructor(code: AppErrorCode, message: string, details: AppErrorDetails = {}) {
    super(message);
    this.code = code;
    this.details = details;
  }
}

export function isAppError(value: unknown): value is AppError {
  return value instanceof AppError;
}

const KNOWN_CODES: ReadonlySet<string> = new Set<string>([
  ...GENERAL_ERROR_CODES,
  ...BUSINESS_ERROR_CODES,
]);

function isKnownCode(code: string): code is AppErrorCode {
  return KNOWN_CODES.has(code);
}

/** User-facing fallback messages. Business-specific wording comes from the RPC `hint`. */
const DEFAULT_MESSAGES: Record<GeneralErrorCode, string> = {
  VALIDATION_ERROR: 'Some of the information is not valid.',
  UNAUTHENTICATED: 'Please sign in to continue.',
  FORBIDDEN: "You don't have permission to do that.",
  NOT_FOUND: "We couldn't find that. It may have been removed or you may not have access.",
  CONFLICT: 'That already exists.',
  VERSION_MISMATCH: 'Someone else changed this just now. Reload to see the latest version.',
  PROJECT_ARCHIVED: 'This project is archived and read-only.',
  RATE_LIMITED: 'Too many attempts. Please wait a moment and try again.',
  INTERNAL_ERROR: 'Something went wrong. Please try again.',
};

function defaultMessage(code: AppErrorCode): string {
  return code in DEFAULT_MESSAGES
    ? DEFAULT_MESSAGES[code as GeneralErrorCode]
    : DEFAULT_MESSAGES.INTERNAL_ERROR;
}

/** PostgreSQL SQLSTATE and PostgREST codes → app codes (plan §7.7). */
const SOURCE_CODE_MAP: Record<string, GeneralErrorCode> = {
  '42501': 'FORBIDDEN', // insufficient_privilege (RLS / grants)
  '23505': 'CONFLICT', // unique_violation
  '23503': 'VALIDATION_ERROR', // foreign_key_violation
  '23514': 'VALIDATION_ERROR', // check_violation
  '22P02': 'VALIDATION_ERROR', // invalid_text_representation (bad uuid, enum, ...)
  PGRST116: 'NOT_FOUND', // .single() returned no rows
  PGRST301: 'UNAUTHENTICATED', // JWT invalid / expired
  PGRST303: 'UNAUTHENTICATED', // JWT expired
};

/** Supabase Auth error codes → app codes (plan §9.2). Others fall back by HTTP status. */
const AUTH_CODE_MAP: Record<string, GeneralErrorCode> = {
  invalid_credentials: 'UNAUTHENTICATED',
  email_not_confirmed: 'UNAUTHENTICATED',
  session_not_found: 'UNAUTHENTICATED',
  session_expired: 'UNAUTHENTICATED',
  refresh_token_not_found: 'UNAUTHENTICATED',
  refresh_token_already_used: 'UNAUTHENTICATED',
  user_already_exists: 'CONFLICT',
  email_exists: 'CONFLICT',
  weak_password: 'VALIDATION_ERROR',
  validation_failed: 'VALIDATION_ERROR',
  over_request_rate_limit: 'RATE_LIMITED',
  over_email_send_rate_limit: 'RATE_LIMITED',
  // M2 (Auth config): password change and email-link flows
  current_password_required: 'VALIDATION_ERROR',
  current_password_invalid: 'VALIDATION_ERROR',
  same_password: 'VALIDATION_ERROR',
  otp_expired: 'VALIDATION_ERROR',
  captcha_failed: 'VALIDATION_ERROR',
};

function statusToCode(status: number): GeneralErrorCode {
  if (status === 401) return 'UNAUTHENTICATED';
  if (status === 403) return 'FORBIDDEN';
  if (status === 404) return 'NOT_FOUND';
  if (status === 409) return 'CONFLICT';
  if (status === 429) return 'RATE_LIMITED';
  if (status === 400 || status === 422) return 'VALIDATION_ERROR';
  return 'INTERNAL_ERROR';
}

type Shape = Record<string, unknown>;

function isObject(value: unknown): value is Shape {
  return typeof value === 'object' && value !== null;
}

function str(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function num(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

type MaybeDetails = { [K in keyof AppErrorDetails]?: AppErrorDetails[K] | undefined };

/** Drops undefined fields so details stay clean under exactOptionalPropertyTypes. */
function withDefined(details: MaybeDetails): AppErrorDetails {
  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(details)) {
    if (value !== undefined) clean[key] = value;
  }
  return clean;
}

/**
 * Converts anything thrown or returned as `error` by supabase-js into an AppError.
 *
 * - P0001 + message → business code (or a general code raised by an RPC, e.g. VERSION_MISMATCH)
 * - 42501 → FORBIDDEN · 23505 → CONFLICT · 23503 / 23514 / 22P02 → VALIDATION_ERROR · PGRST116 → NOT_FOUND
 * - Auth 429 → RATE_LIMITED (plus the Auth codes in AUTH_CODE_MAP)
 * - Edge Function JSON `{ code, message, details }` with a known code → that code
 * - anything else → INTERNAL_ERROR
 */
export function toAppError(error: unknown): AppError {
  if (isAppError(error)) return error;

  if (!isObject(error)) {
    return new AppError(
      'INTERNAL_ERROR',
      DEFAULT_MESSAGES.INTERNAL_ERROR,
      withDefined({
        info: error,
      }),
    );
  }

  const code = str(error.code);
  const message = str(error.message);
  const hint = str(error.hint);
  const status = num(error.status);
  const info = error.details ?? undefined;

  // 1. RPC business errors: raise exception 'CODE' using errcode = 'P0001'
  if (code === 'P0001') {
    const raised = message?.trim();
    if (raised && isKnownCode(raised)) {
      return new AppError(
        raised,
        hint ?? defaultMessage(raised),
        withDefined({
          sourceCode: code,
          info,
        }),
      );
    }
    return new AppError(
      'INTERNAL_ERROR',
      DEFAULT_MESSAGES.INTERNAL_ERROR,
      withDefined({
        sourceCode: code,
        unknownCode: raised,
        info,
      }),
    );
  }

  // 2. Postgres / PostgREST codes
  if (code && code in SOURCE_CODE_MAP) {
    const mapped = SOURCE_CODE_MAP[code] ?? 'INTERNAL_ERROR';
    return new AppError(
      mapped,
      defaultMessage(mapped),
      withDefined({
        sourceCode: code,
        status,
        info,
      }),
    );
  }

  // 3. Supabase Auth errors (AuthApiError and friends carry __isAuthError)
  if (error.__isAuthError === true || error.name === 'AuthApiError') {
    const mapped =
      (code ? AUTH_CODE_MAP[code] : undefined) ??
      (status !== undefined ? statusToCode(status) : 'INTERNAL_ERROR');
    return new AppError(
      mapped,
      defaultMessage(mapped),
      withDefined({
        sourceCode: code,
        status,
      }),
    );
  }

  // 4. Already-shaped errors, e.g. Edge Function JSON bodies { code, message, details }
  if (code && isKnownCode(code)) {
    return new AppError(code, message ?? defaultMessage(code), withDefined({ status, info }));
  }

  // 5. Bare HTTP errors
  if (status !== undefined) {
    const mapped = statusToCode(status);
    return new AppError(
      mapped,
      defaultMessage(mapped),
      withDefined({
        sourceCode: code,
        status,
        info,
      }),
    );
  }

  return new AppError(
    'INTERNAL_ERROR',
    DEFAULT_MESSAGES.INTERNAL_ERROR,
    withDefined({
      sourceCode: code,
      info: message ?? info,
    }),
  );
}
