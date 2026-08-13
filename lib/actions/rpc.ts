import "server-only";

import { createClient } from "@/lib/supabase/server";
import { fail, mapPostgresError, ok, type ActionResult } from "@/lib/domain/errors";

/**
 * Runs a Supabase call and folds any failure into the §9.6 contract, so raw
 * database text never escapes to the client (§8.3).
 */
export async function guard<T>(fn: () => Promise<{ data: T; error: unknown }>): Promise<ActionResult<T>> {
  try {
    const { data, error } = await fn();
    if (error) return { ok: false, error: mapPostgresError(error) };
    return ok(data);
  } catch (error) {
    return { ok: false, error: mapPostgresError(error) };
  }
}

/** The signed-in user id, or an UNAUTHENTICATED result. */
export async function currentUserId(): Promise<ActionResult<string>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("UNAUTHENTICATED");
  return ok(user.id);
}
