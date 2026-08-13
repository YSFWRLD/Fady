import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * §9.9 — the hourly scheduled job. It marks ended plans completed and creates
 * the single 24-hour reminder per pending/going attendee. The RPC is idempotent
 * and relies on the notification dedupe constraint, so retries are safe.
 *
 * §9.10: the shared secret is server-only and is compared in constant time.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }

  const header = request.headers.get("authorization") ?? "";
  if (!timingSafeEqual(header, `Bearer ${secret}`)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("run_scheduled_jobs", {});

  if (error) {
    // Never leak raw database text, even to an operator endpoint.
    return NextResponse.json({ error: "job_failed" }, { status: 500 });
  }

  const row = Array.isArray(data) ? data[0] : data;
  return NextResponse.json({ ok: true, completed: row?.completed ?? 0, reminders: row?.reminders ?? 0 });
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
