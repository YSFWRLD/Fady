"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { fail, mapPostgresError, ok, type ActionResult } from "@/lib/domain/errors";
import {
  changeMemberRoleSchema,
  createGroupSchema,
  firstIssue,
  updateGroupSchema,
  uuidSchema,
} from "@/lib/domain/schemas";
import type { GroupRole } from "@/lib/domain/types";

/**
 * SHR-003: a share link carries only the opaque invite token — never a group id,
 * name, or member data.
 */
function inviteUrl(token: string) {
  const origin = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");
  return `${origin}/join/${token}`;
}

/** GRP-001 — group, owner membership, colour, and first invite in one transaction. */
export async function createGroup(input: {
  name: string;
  imagePath?: string | null;
}): Promise<ActionResult<{ groupId: string; inviteUrl: string }>> {
  const parsed = createGroupSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION_ERROR", firstIssue(parsed.error).field);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_group", {
    p_name: parsed.data.name,
    p_image_path: parsed.data.imagePath ?? null,
  });
  if (error) return { ok: false, error: mapPostgresError(error) };

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return fail("NETWORK_ERROR");

  revalidatePath("/groups");
  revalidatePath("/home");
  return ok({ groupId: row.group_id, inviteUrl: inviteUrl(row.invite_token) });
}

/** GRP-004 — owner/admin edit the name and image. */
export async function updateGroup(input: {
  groupId: string;
  name?: string;
  imagePath?: string | null;
}): Promise<ActionResult<null>> {
  const parsed = updateGroupSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION_ERROR", firstIssue(parsed.error).field);

  const patch: { name?: string; image_path?: string | null } = {};
  if (parsed.data.name !== undefined) patch.name = parsed.data.name;
  if (parsed.data.imagePath !== undefined) patch.image_path = parsed.data.imagePath;
  if (Object.keys(patch).length === 0) return ok(null);

  const supabase = await createClient();
  // RLS (groups_update_admin) is the authorization boundary here.
  const { error } = await supabase.from("groups").update(patch).eq("id", parsed.data.groupId);
  if (error) return { ok: false, error: mapPostgresError(error) };

  revalidatePath(`/groups/${parsed.data.groupId}`);
  return ok(null);
}

/** INV-003 — rotating immediately revokes the previous active link. */
export async function rotateGroupInvite(groupId: string): Promise<ActionResult<{ url: string }>> {
  if (!uuidSchema.safeParse(groupId).success) return fail("VALIDATION_ERROR");

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("rotate_group_invite", { p_group: groupId });
  if (error) return { ok: false, error: mapPostgresError(error) };

  revalidatePath(`/groups/${groupId}`);
  return ok({ url: inviteUrl(data as unknown as string) });
}

/** INV-005/INV-006 — atomic redemption; duplicates route to the group. */
export async function redeemGroupInvite(token: string): Promise<ActionResult<{ groupId: string }>> {
  if (!token || token.length > 128) return fail("NOT_FOUND");

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("redeem_group_invite", { p_token: token });
  if (error) return { ok: false, error: mapPostgresError(error) };

  revalidatePath("/groups");
  revalidatePath("/home");
  return ok({ groupId: data as unknown as string });
}

/** GRP-005 — owner only; passing `owner` performs the transfer. */
export async function changeMemberRole(input: {
  groupId: string;
  userId: string;
  role: GroupRole;
}): Promise<ActionResult<null>> {
  const parsed = changeMemberRoleSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION_ERROR");

  const supabase = await createClient();
  const { error } = await supabase.rpc("change_member_role", {
    p_group: parsed.data.groupId,
    p_user: parsed.data.userId,
    p_role: parsed.data.role,
  });
  if (error) return { ok: false, error: mapPostgresError(error) };

  revalidatePath(`/groups/${parsed.data.groupId}`);
  return ok(null);
}

/** GRP-004/GRP-008 — access ends immediately, history is preserved. */
export async function removeGroupMember(groupId: string, userId: string): Promise<ActionResult<null>> {
  if (!uuidSchema.safeParse(groupId).success || !uuidSchema.safeParse(userId).success) {
    return fail("VALIDATION_ERROR");
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("remove_group_member", { p_group: groupId, p_user: userId });
  if (error) return { ok: false, error: mapPostgresError(error) };

  revalidatePath(`/groups/${groupId}`);
  return ok(null);
}

/** GRP-007 — an owner with other members must transfer ownership first. */
export async function leaveGroup(groupId: string): Promise<ActionResult<null>> {
  if (!uuidSchema.safeParse(groupId).success) return fail("VALIDATION_ERROR");

  const supabase = await createClient();
  const { error } = await supabase.rpc("leave_group", { p_group: groupId });
  if (error) return { ok: false, error: mapPostgresError(error) };

  revalidatePath("/groups");
  revalidatePath("/home");
  return ok(null);
}

/** GRP-009 — soft delete, revoke invites, cancel plans, notify members. */
export async function deleteGroup(groupId: string): Promise<ActionResult<null>> {
  if (!uuidSchema.safeParse(groupId).success) return fail("VALIDATION_ERROR");

  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_group", { p_group: groupId });
  if (error) return { ok: false, error: mapPostgresError(error) };

  revalidatePath("/groups");
  revalidatePath("/home");
  return ok(null);
}
