"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Keeps every screen live without a manual refresh.
 *
 * Realtime previously covered only the round page and the notification badge,
 * so availability, new plans, RSVPs and vote counts sat stale everywhere else
 * until you reloaded. This subscribes once, at the shell, to the tables the
 * product's shared state actually lives in.
 *
 * §9.8 still holds: a payload is only a signal. Nothing here trusts the row it
 * receives — it triggers `router.refresh()`, and the server re-reads under the
 * caller's RLS. Realtime respects RLS too, so a payload only arrives for rows
 * this user may already see.
 *
 * Refreshes are debounced because one action fans out into several row events
 * (confirming a plan writes a round, a plan, N attendees and N notifications);
 * without it a single confirm would trigger a burst of refetches.
 */
const WATCHED_TABLES = [
  "availability_slots",
  "planning_rounds",
  "plan_suggestions",
  "suggestion_votes",
  "confirmed_plans",
  "plan_attendees",
] as const;

const DEBOUNCE_MS = 400;

export function LiveRefresh() {
  const router = useRouter();
  const pathname = usePathname();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const supabase = createClient();

    const scheduleRefresh = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => router.refresh(), DEBOUNCE_MS);
    };

    const channel = supabase.channel("live-refresh");
    for (const table of WATCHED_TABLES) {
      channel.on("postgres_changes", { event: "*", schema: "public", table }, scheduleRefresh);
    }
    channel.subscribe();

    // Cover the gap where the tab was backgrounded and missed events.
    const onFocus = () => router.refresh();
    window.addEventListener("focus", onFocus);

    return () => {
      if (timer.current) clearTimeout(timer.current);
      window.removeEventListener("focus", onFocus);
      void supabase.removeChannel(channel);
    };
    // Re-subscribing per route keeps the refresh bound to the visible page.
  }, [router, pathname]);

  return null;
}
