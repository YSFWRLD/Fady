"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { fail, mapPostgresError, ok, type ActionResult } from "@/lib/domain/errors";
import { attendanceSchema, cancelPlanSchema, uuidSchema } from "@/lib/domain/schemas";
import type { AttendanceStatus } from "@/lib/domain/types";

export type PlanConflict = {
  planId: string;
  title: string;
  startAt: string;
  endAt: string;
  groupName: string;
};

export type AttendanceOutcome =
  | { outcome: "saved"; status: AttendanceStatus }
  /** Accepting would double-book; the caller must choose before we write. */
  | { outcome: "conflict"; conflicts: PlanConflict[] };

/**
 * CNF-004/CNF-005 — attendance is always an explicit answer, never inferred.
 *
 * Saying "أكيد" to a plan that overlaps one you already accepted returns the
 * clashing plans instead of silently double-booking you. Confirm by calling
 * again with `withdrawFrom`, which stands you down from those plans and accepts
 * this one in a single transaction. §7.5: conflicts are surfaced, never
 * auto-resolved.
 */
export async function respondAttendance(input: {
  planId: string;
  status: Exclude<AttendanceStatus, "pending">;
  withdrawFrom?: string[];
}): Promise<ActionResult<AttendanceOutcome>> {
  const parsed = attendanceSchema.safeParse({ planId: input.planId, status: input.status });
  if (!parsed.success) return fail("VALIDATION_ERROR");

  const withdrawFrom = (input.withdrawFrom ?? []).filter((id) => uuidSchema.safeParse(id).success);
  const supabase = await createClient();

  // Only an unforced "going" can conflict — declining never double-books.
  if (parsed.data.status === "going" && withdrawFrom.length === 0) {
    const { data: clashes, error: clashError } = await supabase.rpc("attendance_conflicts", {
      p_plan: parsed.data.planId,
    });
    if (clashError) return { ok: false, error: mapPostgresError(clashError) };

    const conflicts = (clashes ?? []) as {
      plan_id: string;
      title: string;
      start_at: string;
      end_at: string;
      group_name: string;
    }[];

    if (conflicts.length > 0) {
      return ok({
        outcome: "conflict",
        conflicts: conflicts.map((c) => ({
          planId: c.plan_id,
          title: c.title,
          startAt: c.start_at,
          endAt: c.end_at,
          groupName: c.group_name,
        })),
      });
    }
  }

  const { data, error } = await supabase.rpc("respond_attendance_resolving", {
    p_plan: parsed.data.planId,
    p_status: parsed.data.status,
    p_withdraw_from: withdrawFrom,
  });
  if (error) return { ok: false, error: mapPostgresError(error) };

  revalidatePath("/home");
  revalidatePath("/calendar");
  return ok({ outcome: "saved", status: (data as { status: AttendanceStatus }).status });
}

/** CNF-007 — an admin cancels; the plan stays visible as cancelled. */
export async function cancelConfirmedPlan(input: {
  planId: string;
  reason?: string | null;
}): Promise<ActionResult<null>> {
  const parsed = cancelPlanSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION_ERROR");

  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_confirmed_plan", {
    p_plan: parsed.data.planId,
    p_reason: parsed.data.reason ?? null,
  });
  if (error) return { ok: false, error: mapPostgresError(error) };

  revalidatePath("/home");
  revalidatePath("/calendar");
  return ok(null);
}

/** NOT-003 */
export async function markNotificationRead(notificationId: string): Promise<ActionResult<null>> {
  if (!uuidSchema.safeParse(notificationId).success) return fail("VALIDATION_ERROR");

  const supabase = await createClient();
  const { error } = await supabase.rpc("mark_notification_read", { p_notification: notificationId });
  if (error) return { ok: false, error: mapPostgresError(error) };

  revalidatePath("/notifications");
  return ok(null);
}

/** NOT-003 */
export async function markAllNotificationsRead(): Promise<ActionResult<null>> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("mark_all_notifications_read", {});
  if (error) return { ok: false, error: mapPostgresError(error) };

  revalidatePath("/notifications");
  return ok(null);
}
