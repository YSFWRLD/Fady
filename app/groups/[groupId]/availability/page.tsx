import { notFound } from "next/navigation";
import { Shell } from "@/components/shell";
import { AvailabilityEditor } from "@/components/availability-editor";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { addDays } from "@/lib/domain/format";
import { PLANNING_HORIZON_DAYS } from "@/lib/domain/types";

export const dynamic = "force-dynamic";

/** AVL-002 — the editor only ever loads and writes the caller's own intervals. */
export default async function AvailabilityPage({ params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await params;
  const profile = await requireProfile(`/groups/${groupId}/availability`);
  const supabase = await createClient();

  const { data: group } = await supabase.from("groups").select("id, name").eq("id", groupId).maybeSingle();
  if (!group) notFound();

  const now = new Date();
  const { data: slots } = await supabase
    .from("availability_slots")
    .select("start_at, end_at")
    .eq("group_id", groupId)
    .eq("user_id", profile.id)
    .gt("end_at", now.toISOString())
    .lt("start_at", addDays(now, PLANNING_HORIZON_DAYS).toISOString())
    .order("start_at");

  return (
    <Shell
      title="حط وقتك"
      lede={`اختر الأوقات اللي تكون فيها فاضي في ${group.name}. كل الأوقات بتوقيت السعودية.`}
      back={`/groups/${groupId}`}
    >
      <AvailabilityEditor
        groupId={groupId}
        groupName={group.name}
        initialIntervals={(slots ?? []).map((s) => ({ startAt: s.start_at, endAt: s.end_at }))}
      />
    </Shell>
  );
}
