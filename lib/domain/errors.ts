/**
 * Server contract conventions — PRD §9.6.
 *
 * Actions return stable English error codes; the client maps them to Saudi
 * Arabic copy. §8.3: raw database or Supabase error text is never shown.
 */

export type ErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION_ERROR"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "INVITE_EXPIRED"
  | "INVITE_REVOKED"
  | "GROUP_FULL"
  | "ROUND_CLOSED"
  | "NETWORK_ERROR";

export type ActionError = { code: ErrorCode; field?: string };

export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: ActionError };

export function ok<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

export function fail<T = never>(code: ErrorCode, field?: string): ActionResult<T> {
  return { ok: false, error: field ? { code, field } : { code } };
}

const MESSAGES: Record<ErrorCode, string> = {
  UNAUTHENTICATED: "لازم تسجل دخول أول",
  FORBIDDEN: "ما عندك صلاحية لهذي الخطوة",
  NOT_FOUND: "ما لقينا اللي تدور عليه",
  VALIDATION_ERROR: "فيه شي ناقص أو غير صحيح",
  CONFLICT: "صار تعارض، حدّث الصفحة وجرّب مرة ثانية",
  RATE_LIMITED: "حاولت كثير، خذ لك شوي وجرّب بعدين",
  INVITE_EXPIRED: "الرابط انتهت صلاحيته",
  INVITE_REVOKED: "الرابط ما عاد شغال",
  GROUP_FULL: "القروب مكتمل",
  ROUND_CLOSED: "التصويت أُقفل",
  NETWORK_ERROR: "ما حفظنا التغيير، جرّب مرة ثانية",
};

export function errorMessage(error: ActionError | ErrorCode): string {
  const code = typeof error === "string" ? error : error.code;
  return MESSAGES[code] ?? MESSAGES.NETWORK_ERROR;
}

/**
 * Maps a Postgres/PostgREST failure onto a contract code. RPCs raise the codes
 * verbatim (e.g. `GROUP_FULL`), so the message is matched before falling back
 * to SQLSTATE classes.
 */
export function mapPostgresError(error: unknown): ActionError {
  const message = (error as { message?: string })?.message ?? "";
  const code = (error as { code?: string })?.code ?? "";

  const known: ErrorCode[] = [
    "UNAUTHENTICATED",
    "FORBIDDEN",
    "NOT_FOUND",
    "VALIDATION_ERROR",
    "CONFLICT",
    "RATE_LIMITED",
    "INVITE_EXPIRED",
    "INVITE_REVOKED",
    "GROUP_FULL",
    "ROUND_CLOSED",
  ];
  for (const c of known) {
    if (message.includes(c)) return { code: c };
  }

  if (code === "23505") return { code: "CONFLICT" };
  if (code === "23514" || code === "22001") return { code: "VALIDATION_ERROR" };
  if (code === "42501" || code === "PGRST301") return { code: "FORBIDDEN" };
  if (code === "PGRST116") return { code: "NOT_FOUND" };
  return { code: "NETWORK_ERROR" };
}
