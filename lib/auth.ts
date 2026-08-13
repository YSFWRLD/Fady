import "server-only";

import { redirect } from "next/navigation";
import { createClient } from "./supabase/server";
import type { Profile } from "./domain/types";

/** The signed-in user, or null. Always uses getUser() so the JWT is verified. */
export async function getUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/**
 * AUTH-005: the caller's profile, redirecting to sign-in or onboarding when the
 * account is not ready for private data. Middleware enforces the same rules;
 * this is the server-side belt-and-braces for direct page loads.
 */
export async function requireProfile(nextPath?: string): Promise<Profile> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(nextPath ? `/auth/sign-in?next=${encodeURIComponent(nextPath)}` : "/auth/sign-in");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_path, onboarding_completed_at")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) redirect("/auth/sign-in");
  if (!profile.onboarding_completed_at) redirect("/onboarding");

  return profile as Profile;
}

/** A relative same-site path, or null. Blocks open redirects (§4.3). */
export function safeNext(next: string | null | undefined): string | null {
  if (!next) return null;
  if (!next.startsWith("/") || next.startsWith("//")) return null;
  return next;
}
