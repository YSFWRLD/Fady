"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { fail, mapPostgresError, ok, type ActionResult } from "@/lib/domain/errors";
import { completeProfileSchema, firstIssue, searchUsersSchema } from "@/lib/domain/schemas";
import type { Profile, PublicProfile } from "@/lib/domain/types";

/** PRO-001/PRO-002 — the required onboarding step. */
export async function completeProfile(input: {
  displayName: string;
  username: string;
  avatarPath?: string | null;
}): Promise<ActionResult<Profile>> {
  const parsed = completeProfileSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION_ERROR", firstIssue(parsed.error).field);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("complete_profile", {
    p_display_name: parsed.data.displayName,
    p_username: parsed.data.username,
    p_avatar_path: parsed.data.avatarPath ?? null,
  });

  if (error) {
    const mapped = mapPostgresError(error);
    // The only realistic conflict here is a taken username.
    return { ok: false, error: mapped.code === "CONFLICT" ? { code: "CONFLICT", field: "username" } : mapped };
  }

  revalidatePath("/", "layout");
  return ok(data as unknown as Profile);
}

/** PRO-004 — editing name, username, and avatar reuses the same RPC. */
export async function updateProfile(input: {
  displayName: string;
  username: string;
  avatarPath?: string | null;
}): Promise<ActionResult<Profile>> {
  const result = await completeProfile(input);
  if (result.ok) revalidatePath("/profile");
  return result;
}

/** FRN-001 — prefix search, capped at 20 results by the RPC. */
export async function searchUsers(query: string): Promise<ActionResult<PublicProfile[]>> {
  const parsed = searchUsersSchema.safeParse({ query });
  if (!parsed.success) return fail("VALIDATION_ERROR", "query");

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("search_users", { p_query: parsed.data.query, p_limit: 20 });
  if (error) return { ok: false, error: mapPostgresError(error) };

  return ok((data ?? []) as PublicProfile[]);
}

/**
 * §9.4 — a signed URL for a private storage object. Avatars and group images are
 * never publicly addressable.
 */
export async function signedImageUrl(bucket: "avatars" | "group-images", path: string | null) {
  if (!path) return null;
  const supabase = await createClient();
  const { data } = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 60);
  return data?.signedUrl ?? null;
}
