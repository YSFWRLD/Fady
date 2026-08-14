"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { siteOrigin } from "@/lib/site-url";
import { fail, ok, type ActionResult } from "@/lib/domain/errors";
import { emailSchema, firstIssue, passwordSchema, signInSchema, signUpSchema } from "@/lib/domain/schemas";
import { safeNext } from "@/lib/auth";

// Origin resolution lives in one place now — see lib/site-url.ts for why.

/**
 * AUTH-001/AUTH-002: register and require email confirmation. AUTH-006: the
 * result never reveals whether the address was already registered.
 */
export async function signUp(input: {
  email: string;
  password: string;
  next?: string;
}): Promise<ActionResult<{ confirmationRequired: boolean }>> {
  const parsed = signUpSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION_ERROR", firstIssue(parsed.error).field);

  const supabase = await createClient();
  const origin = await siteOrigin();
  const next = safeNext(parsed.data.next) ?? "/home";

  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      // AUTH-004: the invite intent rides along through confirmation.
      emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });

  if (error) {
    // Supabase returns 429 both for "this IP is signing up too fast" and for
    // "the project used up its hourly email quota" — very different causes. The
    // second is a project-wide limit any user can trip through no fault of
    // their own, so it gets its own message rather than accusing them of
    // hammering the form.
    if (isEmailSendLimit(error)) return fail("EMAIL_SEND_LIMIT");
    if (error.status === 429) return fail("RATE_LIMITED");
    // A duplicate address is reported as the same neutral success state.
    if (error.message.toLowerCase().includes("already")) return ok({ confirmationRequired: true });
    return fail("VALIDATION_ERROR");
  }

  return ok({ confirmationRequired: true });
}

/** Distinguishes the project-wide email quota from per-IP request throttling. */
function isEmailSendLimit(error: { code?: string; message?: string }): boolean {
  if (error.code === "over_email_send_rate_limit") return true;
  const message = (error.message ?? "").toLowerCase();
  return message.includes("email rate limit") || message.includes("over_email_send_rate_limit");
}

/** AUTH-003. AUTH-006: a wrong password and an unknown email look identical. */
export async function signIn(input: {
  email: string;
  password: string;
  next?: string;
}): Promise<ActionResult<{ next: string }>> {
  const parsed = signInSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION_ERROR", firstIssue(parsed.error).field);

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    if (error.status === 429) return fail("RATE_LIMITED");
    return fail("UNAUTHENTICATED");
  }

  revalidatePath("/", "layout");
  return ok({ next: safeNext(parsed.data.next) ?? "/home" });
}

export async function signOut(): Promise<ActionResult<null>> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  return ok(null);
}

/**
 * AUTH-003 + acceptance criterion: known and unknown addresses receive the same
 * neutral confirmation, so the endpoint is not an account-existence oracle.
 */
export async function requestPasswordReset(email: string): Promise<ActionResult<null>> {
  const parsed = emailSchema.safeParse(email);
  if (!parsed.success) return fail("VALIDATION_ERROR", "email");

  const supabase = await createClient();
  const origin = await siteOrigin();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data, {
    redirectTo: `${origin}/auth/callback?next=${encodeURIComponent("/auth/reset-password")}`,
  });

  if (error && isEmailSendLimit(error)) return fail("EMAIL_SEND_LIMIT");
  if (error?.status === 429) return fail("RATE_LIMITED");
  return ok(null);
}

/** Completes the reset once the callback has exchanged the recovery code. */
export async function updatePassword(password: string): Promise<ActionResult<null>> {
  const parsed = passwordSchema.safeParse(password);
  if (!parsed.success) return fail("VALIDATION_ERROR", "password");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("UNAUTHENTICATED");

  const { error } = await supabase.auth.updateUser({ password: parsed.data });
  if (error) return fail("VALIDATION_ERROR", "password");

  revalidatePath("/", "layout");
  return ok(null);
}
