import { notFound, redirect } from "next/navigation";
import { Shell } from "@/components/shell";
import { RoundView } from "./round-view";
import { requireProfile } from "@/lib/auth";
import { getRound } from "@/lib/data/queries";

export const dynamic = "force-dynamic";

/** SHR-004 — membership is enforced before any private detail is returned. */
export default async function RoundPage({ params }: { params: Promise<{ groupId: string; roundId: string }> }) {
  const { groupId, roundId } = await params;
  await requireProfile(`/groups/${groupId}/plans/${roundId}`);

  const round = await getRound(roundId);
  if (!round || round.groupId !== groupId) notFound();

  // A confirmed round lives on as the plan it produced.
  if (round.status === "confirmed" && round.confirmedPlanId) {
    redirect(`/groups/${groupId}/events/${round.confirmedPlanId}`);
  }

  return (
    <Shell back={`/groups/${groupId}`}>
      <RoundView
        round={{
          ...round,
          windowStartAt: round.windowStartAt.toISOString(),
          windowEndAt: round.windowEndAt.toISOString(),
          suggestions: round.suggestions.map((s) => ({
            ...s,
            startAt: s.startAt.toISOString(),
            endAt: s.endAt.toISOString(),
          })),
        }}
      />
    </Shell>
  );
}
