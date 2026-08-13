"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { fail, mapPostgresError, ok, type ActionResult } from "@/lib/domain/errors";
import { uuidSchema } from "@/lib/domain/schemas";

/** FRN-002/FRN-008 — one pending request per pair, with the rejection cooldown. */
export async function sendFriendRequest(targetUserId: string): Promise<ActionResult<{ id: string }>> {
  if (!uuidSchema.safeParse(targetUserId).success) return fail("VALIDATION_ERROR");

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("send_friend_request", { p_target: targetUserId });
  if (error) return { ok: false, error: mapPostgresError(error) };

  revalidatePath("/friends");
  return ok({ id: (data as { id: string }).id });
}

/** FRN-003 — only the recipient accepts or rejects. */
export async function respondFriendRequest(
  friendshipId: string,
  accept: boolean,
): Promise<ActionResult<{ status: string }>> {
  if (!uuidSchema.safeParse(friendshipId).success) return fail("VALIDATION_ERROR");

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("respond_friend_request", {
    p_friendship: friendshipId,
    p_accept: accept,
  });
  if (error) return { ok: false, error: mapPostgresError(error) };

  revalidatePath("/friends");
  return ok({ status: (data as { status: string }).status });
}

/** FRN-005/FRN-006 — removing a friendship never touches shared group access. */
export async function removeFriend(friendshipId: string): Promise<ActionResult<null>> {
  if (!uuidSchema.safeParse(friendshipId).success) return fail("VALIDATION_ERROR");

  const supabase = await createClient();
  const { error } = await supabase.rpc("remove_friend", { p_friendship: friendshipId });
  if (error) return { ok: false, error: mapPostgresError(error) };

  revalidatePath("/friends");
  return ok(null);
}
