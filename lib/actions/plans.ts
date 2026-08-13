"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { fail, mapPostgresError, ok, type ActionResult } from "@/lib/domain/errors";
import { attendanceSchema, cancelPlanSchema, uuidSchema } from "@/lib/domain/schemas";
import type { AttendanceStatus } from "@/lib/domain/types";

/** CNF-004/CNF-005 — attendance is always an explicit answer, never inferred. */
export async function respondAttendance(input: {
  planId: string;
  status: Exclude<AttendanceStatus, "pending">;
}): Promise<ActionResult<{ status: AttendanceStatus }>> {
  const parsed = attendanceSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION_ERROR");

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("respond_attendance", {
    p_plan: parsed.data.planId,
    p_status: parsed.data.status,
  });
  if (error) return { ok: false, error: mapPostgresError(error) };

  revalidatePath("/home");
  revalidatePath("/calendar");
  return ok({ status: (data as { status: AttendanceStatus }).status });
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
