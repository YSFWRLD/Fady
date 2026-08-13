import { notFound } from "next/navigation";
import { Shell } from "@/components/shell";
import { NewRoundForm } from "./new-round-form";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getGroupCalendar } from "@/lib/data/queries";
import { countAvailableInWindow } from "@/lib/domain/overlap";

export const dynamic = "force-dynamic";

/** PLN-001/PLN-002 — a round starts from a detected overlap or a manual window. */
export default async function NewRoundPage({
  params,
  searchParams,
}: {
  params: Promise<{ groupId: string }>;
  searchParams: Promise<{ start?: string; end?: string }>;
}) {
  const { groupId } = await params;
  const { start, end } = await searchParams;
  await requireProfile(`/groups/${groupId}/plans/new`);

  const supabase = await createClient();
  const { data: group } = await supabase.from("groups").select("id, name").eq("id", groupId).maybeSingle();
  if (!group) notFound();

  const { members, slots, overlaps } = await getGroupCalendar(groupId);

  // PLN-010: the exact count of members free for the whole preset window.
  const presetStart = start ? new Date(start) : null;
  const presetEnd = end ? new Date(end) : null;
  const presetAvailable =
    presetStart && presetEnd && !Number.isNaN(presetStart.getTime()) && !Number.isNaN(presetEnd.getTime())
      ? countAvailableInWindow({
          intervals: slots.map((s) => ({ userId: s.userId, startAt: s.startAt, endAt: s.endAt })),
          activeMemberIds: members.map((m) => m.userId),
          windowStart: presetStart,
          windowEnd: presetEnd,
        }).availableCount
      : null;

  return (
    <Shell title="وش الخطة؟" lede={`اقترح أول خطة وافتح التصويت في ${group.name}.`} back={`/groups/${groupId}`}>
      <NewRoundForm
        groupId={groupId}
        totalMembers={members.length}
        presetStart={presetStart && !Number.isNaN(presetStart.getTime()) ? presetStart.toISOString() : null}
        presetEnd={presetEnd && !Number.isNaN(presetEnd.getTime()) ? presetEnd.toISOString() : null}
        presetAvailable={presetAvailable}
        overlaps={overlaps.map((o) => ({
          startAt: o.startAt.toISOString(),
          endAt: o.endAt.toISOString(),
          availableCount: o.availableCount,
          totalActiveMembers: o.totalActiveMembers,
          isFullMatch: o.isFullMatch,
        }))}
      />
    </Shell>
  );
}
