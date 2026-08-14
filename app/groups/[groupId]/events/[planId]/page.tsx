import { notFound } from "next/navigation";
import { Shell } from "@/components/shell";
import { PlanView } from "./plan-view";
import { requireProfile } from "@/lib/auth";
import { getPlan } from "@/lib/data/queries";
import { siteOrigin } from "@/lib/site-url";

export const dynamic = "force-dynamic";

/** SHR-004 — a non-member sees the neutral not-found state, never plan details. */
export default async function PlanPage({ params }: { params: Promise<{ groupId: string; planId: string }> }) {
  const { groupId, planId } = await params;
  await requireProfile(`/groups/${groupId}/events/${planId}`);

  const plan = await getPlan(planId);
  if (!plan || plan.groupId !== groupId) notFound();

  // Resolved on the server so the share link is identical in the SSR output and
  // after hydration — deriving it from `window` produced a hydration mismatch.
  const origin = await siteOrigin();

  return (
    <Shell back={`/groups/${groupId}`}>
      <PlanView
        origin={origin}
        plan={{ ...plan, startAt: plan.startAt.toISOString(), endAt: plan.endAt.toISOString() }}
      />
    </Shell>
  );
}
