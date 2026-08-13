"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fail, mapPostgresError, ok, type ActionResult } from "@/lib/domain/errors";
import { firstIssue, replaceAvailabilitySchema } from "@/lib/domain/schemas";
import { computeOverlaps, overlapDedupeKey, type MemberInterval } from "@/lib/domain/overlap";
import { PLANNING_HORIZON_DAYS, type OverlapSlot } from "@/lib/domain/types";
import { addDays } from "@/lib/domain/format";

/**
 * AVL-002/AVL-007 — replaces the caller's own future intervals for one group,
 * merging on save, then recalculates overlaps and emits the OVL-010 threshold
 * notifications. OVL-009: the recalculation happens in the same round trip so
 * the UI reflects the new overlap within a second.
 */
export async function replaceAvailability(input: {
  groupId: string;
  intervals: { startAt: string; endAt: string }[];
  rangeStart: string;
  rangeEnd: string;
}): Promise<ActionResult<{ overlaps: OverlapSlot[] }>> {
  const parsed = replaceAvailabilitySchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION_ERROR", firstIssue(parsed.error).field);

  const supabase = await createClient();
  const { error } = await supabase.rpc("replace_availability", {
    p_group: parsed.data.groupId,
    p_intervals: parsed.data.intervals,
    p_range_start: parsed.data.rangeStart,
    p_range_end: parsed.data.rangeEnd,
  });
  if (error) return { ok: false, error: mapPostgresError(error) };

  const overlaps = await recalculateOverlaps(parsed.data.groupId);

  revalidatePath(`/groups/${parsed.data.groupId}`);
  revalidatePath("/calendar");
  revalidatePath("/home");
  return ok({ overlaps });
}

/**
 * OVL-001 — overlaps are derived on read, never stored. Reads run under the
 * caller's RLS, so a non-member can never trigger a calculation.
 */
export async function recalculateOverlaps(groupId: string): Promise<OverlapSlot[]> {
  const supabase = await createClient();

  const now = new Date();
  const rangeEnd = addDays(now, PLANNING_HORIZON_DAYS);

  const [{ data: members }, { data: slots }] = await Promise.all([
    supabase.from("group_members").select("user_id").eq("group_id", groupId).is("left_at", null),
    supabase
      .from("availability_slots")
      .select("user_id, start_at, end_at")
      .eq("group_id", groupId)
      .gt("end_at", now.toISOString())
      .lt("start_at", rangeEnd.toISOString()),
  ]);

  if (!members || members.length === 0) return [];

  const intervals: MemberInterval[] = (slots ?? []).map((s) => ({
    userId: s.user_id,
    startAt: new Date(s.start_at),
    endAt: new Date(s.end_at),
  }));

  const overlaps = computeOverlaps({
    intervals,
    activeMemberIds: members.map((m) => m.user_id),
    rangeStart: now,
    rangeEnd,
    now,
  });

  await notifyThresholdCrossings(groupId, overlaps, members.map((m) => m.user_id));
  return overlaps;
}

/**
 * OVL-010 / §7.4 — one notification the first time a slot becomes full or first
 * crosses the near threshold. The dedupe key carries the normalized slot, and
 * the unique index makes a repeat within the window a no-op. Notifications are
 * written for other members, so this needs the service role.
 */
async function notifyThresholdCrossings(groupId: string, overlaps: OverlapSlot[], memberIds: string[]) {
  const notable = overlaps.filter((o) => o.isFullMatch || o.isNearMatch);
  if (notable.length === 0) return;
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const admin = createAdminClient();
  const rows = notable.flatMap((slot) =>
    memberIds
      // NOT-004: the member who just saved their availability is the actor.
      .filter((id) => id !== user?.id)
      .map((userId) => ({
        user_id: userId,
        type: slot.isFullMatch ? ("full_overlap" as const) : ("near_overlap" as const),
        actor_id: user?.id ?? null,
        group_id: groupId,
        entity_id: null,
        // §10: no exact free text, only coarse rendering values.
        payload: {
          start_at: slot.startAt.toISOString(),
          end_at: slot.endAt.toISOString(),
          available: slot.availableCount,
          total: slot.totalActiveMembers,
        },
        dedupe_key: overlapDedupeKey(groupId, slot),
      })),
  );

  if (rows.length > 0) {
    await admin.from("notifications").upsert(rows, { onConflict: "user_id,dedupe_key", ignoreDuplicates: true });
  }
}
