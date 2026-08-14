"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Section } from "@/components/app-shell";
import { SuggestionFields, type SuggestionDraft } from "@/components/suggestion-fields";
import { Button } from "@/components/ui/button";
import { Badge, Banner, Card } from "@/components/ui/card";
import { CategoryIcon, CountMeter } from "@/components/ui/identity";
import { addSuggestion, cancelPlanningRound, closePlanningRound, setSuggestionVote, withdrawSuggestion } from "@/lib/actions/planning";
import { errorMessage } from "@/lib/domain/errors";
import { formatRange, toArabicDigits } from "@/lib/domain/format";
import { locationLabel, mapsUrl } from "@/lib/domain/maps";
import { createClient } from "@/lib/supabase/client";
import type { PlanCategory, PlanningRoundStatus } from "@/lib/domain/types";

type SuggestionView = {
  id: string;
  category: PlanCategory;
  title: string;
  description: string | null;
  location: string | null;
  externalUrl: string | null;
  startAt: string;
  endAt: string;
  suggestedByName: string;
  votes: number;
  mine: boolean;
  isOwn: boolean;
};

type Round = {
  id: string;
  groupId: string;
  groupName: string;
  status: PlanningRoundStatus;
  windowStartAt: string;
  windowEndAt: string;
  viewerIsAdmin: boolean;
  availableCount: number;
  totalMembers: number;
  suggestions: SuggestionView[];
};

export function RoundView({ round }: { round: Round }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [pending, startTransition] = useTransition();

  // VOT-005: the viewer's own picks are shown alongside the totals. Optimistic
  // toggles reconcile from the server response after every mutation (§8.5).
  const tallyFromProps = () =>
    Object.fromEntries(round.suggestions.map((s) => [s.id, { votes: s.votes, mine: s.mine }]));

  const [votes, setVotes] = useState(tallyFromProps);

  // When a refetch delivers new server state, the optimistic tally is replaced
  // by it. Adjusting during render (rather than in an effect) avoids showing a
  // stale count for one frame.
  const [seenSuggestions, setSeenSuggestions] = useState(round.suggestions);
  if (seenSuggestions !== round.suggestions) {
    setSeenSuggestions(round.suggestions);
    setVotes(tallyFromProps());
  }

  // §9.8: subscribe only while this round is on screen, and treat a payload as a
  // signal to re-fetch authoritative state rather than as data itself.
  useEffect(() => {
    if (round.status !== "open") return;
    const supabase = createClient();
    const channel = supabase
      .channel(`round:${round.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "suggestion_votes" }, () => router.refresh())
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "plan_suggestions", filter: `round_id=eq.${round.id}` },
        () => router.refresh(),
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "planning_rounds", filter: `id=eq.${round.id}` },
        () => router.refresh(),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [round.id, round.status, router]);

  function toggleVote(id: string) {
    const current = votes[id];
    if (!current) return;
    const next = !current.mine;

    setVotes((prev) => ({
      ...prev,
      [id]: { votes: current.votes + (next ? 1 : -1), mine: next },
    }));
    setError(null);

    startTransition(async () => {
      const result = await setSuggestionVote({ suggestionId: id, selected: next });
      if (!result.ok) {
        setVotes((prev) => ({ ...prev, [id]: current })); // roll back visibly
        setError(errorMessage(result.error));
        return;
      }
      setVotes((prev) => ({ ...prev, [id]: { votes: result.data.votes, mine: result.data.selected } }));
      router.refresh();
    });
  }

  function submitSuggestion(draft: SuggestionDraft) {
    setError(null);
    startTransition(async () => {
      const result = await addSuggestion({
        roundId: round.id,
        category: draft.category,
        title: draft.title,
        description: draft.description || null,
        proposedStartAt: draft.startAt ?? round.windowStartAt,
        proposedEndAt: draft.endAt ?? round.windowEndAt,
        location: draft.location || null,
        externalUrl: draft.externalUrl || null,
      });
      if (!result.ok) {
        setError(errorMessage(result.error));
        return;
      }
      setAdding(false);
      router.refresh();
    });
  }

  function withdraw(id: string) {
    setError(null);
    startTransition(async () => {
      const result = await withdrawSuggestion(id);
      if (!result.ok) setError(errorMessage(result.error));
      else router.refresh();
    });
  }

  function close(winnerId: string) {
    setError(null);
    startTransition(async () => {
      const result = await closePlanningRound({ roundId: round.id, winningSuggestionId: winnerId });
      if (!result.ok) {
        setError(
          result.error.code === "VALIDATION_ERROR"
            ? "لازم تختار خطة من الأعلى تصويتًا"
            : errorMessage(result.error),
        );
        return;
      }
      router.push(`/groups/${round.groupId}/events/${result.data.planId}`);
      router.refresh();
    });
  }

  function cancel() {
    setError(null);
    startTransition(async () => {
      const result = await cancelPlanningRound(round.id);
      if (!result.ok) setError(errorMessage(result.error));
      else router.push(`/groups/${round.groupId}`);
    });
  }

  const top = Math.max(0, ...round.suggestions.map((s) => votes[s.id]?.votes ?? 0));
  // VOT-007/VOT-008: leaders only, unless every option sits at zero.
  const canWin = (id: string) => top === 0 || (votes[id]?.votes ?? 0) === top;

  return (
    <div style={{ display: "grid", gap: "var(--space-6)" }}>
      <Card variant="sticker" tilt="a" tone="celebrate">
        <div style={{ display: "grid", gap: "var(--space-3)" }}>
          <Badge tone="solid">{round.groupName}</Badge>
          <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 26, lineHeight: 1.05, color: "var(--text-strong)" }}>
            {formatRange(new Date(round.windowStartAt), new Date(round.windowEndAt))}
          </span>
          <CountMeter available={round.availableCount} total={round.totalMembers} label="فاضين في هذا الوقت" />
        </div>
      </Card>

      {error ? <Banner tone="error">{error}</Banner> : null}

      <Section
        title="الخطط المقترحة"
        action={
          !adding ? (
            <Button size="sm" tone="quiet" onClick={() => setAdding(true)}>
              اقترح خطة
            </Button>
          ) : null
        }
      >
        <div style={{ display: "grid", gap: "var(--space-3)" }}>
          {round.suggestions.length === 0 ? (
            <Card variant="flat" tone="quiet">
              <span style={{ font: "var(--body-md)", color: "var(--text-muted)" }}>فاضين… بس وش الخطة؟</span>
            </Card>
          ) : null}

          {round.suggestions.map((s) => {
            const v = votes[s.id] ?? { votes: s.votes, mine: s.mine };
            return (
              <Card key={s.id} variant="flat">
                <div style={{ display: "grid", gap: "var(--space-3)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
                    <CategoryIcon category={s.category} size={48} tone={v.mine ? "accent" : "quiet"} />
                    <div style={{ display: "grid", gap: 2, flex: 1, minWidth: 0 }}>
                      <span dir="auto" style={{ font: "var(--title-md)", color: "var(--text-strong)" }}>
                        {s.title}
                      </span>
                      <span style={{ font: "var(--body-sm)", color: "var(--text-muted)" }}>
                        {formatRange(new Date(s.startAt), new Date(s.endAt))} · {s.suggestedByName}
                      </span>
                    </div>
                    <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 24, color: "var(--text-strong)" }}>
                      {toArabicDigits(v.votes)}
                    </span>
                  </div>

                  {s.description ? (
                    <span dir="auto" style={{ font: "var(--body-md)", color: "var(--text-body)" }}>
                      {s.description}
                    </span>
                  ) : null}
                  {s.location ? (
                    <a
                      href={mapsUrl(s.location) ?? undefined}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      dir="auto"
                      style={{ font: "var(--body-sm)" }}
                    >
                      <i className="ph-bold ph-map-pin" aria-hidden="true" /> {locationLabel(s.location)}
                    </a>
                  ) : null}
                  {s.externalUrl ? (
                    // PLN-009: rendered as a plain link; never fetched or previewed.
                    <a href={s.externalUrl} target="_blank" rel="noopener noreferrer nofollow" dir="ltr" style={{ font: "var(--body-sm)" }}>
                      {s.externalUrl}
                    </a>
                  ) : null}

                  <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
                    <Button tone={v.mine ? "primary" : "outline"} size="sm" onClick={() => toggleVote(s.id)}>
                      {v.mine ? "✓ مقبولة عندي" : "أقبلها"}
                    </Button>
                    {s.isOwn ? (
                      <Button tone="quiet" size="sm" onClick={() => withdraw(s.id)}>
                        اسحب اقتراحي
                      </Button>
                    ) : null}
                    {round.viewerIsAdmin ? (
                      <Button
                        tone="secondary"
                        size="sm"
                        disabled={!canWin(s.id)}
                        title={canWin(s.id) ? undefined : "تقدر تختار الأعلى تصويتًا بس"}
                        onClick={() => close(s.id)}
                      >
                        ثبّت هذي الخطة
                      </Button>
                    ) : null}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </Section>

      {adding ? (
        <Section title="اقترح خطة">
          <SuggestionFields
            submitLabel="أضف الاقتراح"
            pending={pending}
            windowStart={round.windowStartAt}
            windowEnd={round.windowEndAt}
            onSubmit={submitSuggestion}
          />
          <Button tone="quiet" onClick={() => setAdding(false)}>
            إلغاء
          </Button>
        </Section>
      ) : null}

      {round.viewerIsAdmin ? (
        <Card variant="flat" tone="quiet">
          <div style={{ display: "grid", gap: "var(--space-2)" }}>
            <span style={{ font: "var(--body-sm)", color: "var(--text-muted)" }}>
              أنت أدمن: تقدر تثبّت الخطة الأعلى تصويتًا، أو تلغي التصويت كامل.
            </span>
            <Button tone="danger" size="sm" onClick={cancel} loading={pending}>
              ألغِ التصويت
            </Button>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
