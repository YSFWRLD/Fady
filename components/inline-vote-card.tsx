"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge, Banner, Card } from "@/components/ui/card";
import { CategoryIcon } from "@/components/ui/identity";
import { closePlanningRound, setSuggestionVote } from "@/lib/actions/planning";
import { errorMessage } from "@/lib/domain/errors";
import { formatRange, toArabicDigits } from "@/lib/domain/format";
import { locationLabel, mapsUrl } from "@/lib/domain/maps";
import type { PlanCategory } from "@/lib/domain/types";

export type InlineSuggestion = {
  id: string;
  category: PlanCategory;
  title: string;
  location: string | null;
  startAt: string;
  endAt: string;
  suggestedByName: string;
  votes: number;
  mine: boolean;
};

/**
 * Voting inline, wherever an open round is listed. Opening a separate page just
 * to tick a box was friction on the single action the product most wants people
 * to take, so the whole ballot renders in place.
 */
export function InlineVoteCard({
  roundId,
  groupId,
  windowStartAt,
  windowEndAt,
  suggestions,
  viewerIsAdmin,
  availableCount,
  totalMembers,
}: {
  roundId: string;
  groupId: string;
  windowStartAt: string;
  windowEndAt: string;
  suggestions: InlineSuggestion[];
  viewerIsAdmin: boolean;
  availableCount: number;
  totalMembers: number;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const fromProps = () =>
    Object.fromEntries(suggestions.map((s) => [s.id, { votes: s.votes, mine: s.mine }]));
  const [votes, setVotes] = useState(fromProps);

  // Replace the optimistic tally when fresh server state arrives.
  const [seen, setSeen] = useState(suggestions);
  if (seen !== suggestions) {
    setSeen(suggestions);
    setVotes(fromProps());
  }

  function toggle(id: string) {
    const current = votes[id];
    if (!current) return;
    const next = !current.mine;

    setVotes((prev) => ({ ...prev, [id]: { votes: current.votes + (next ? 1 : -1), mine: next } }));
    setError(null);

    startTransition(async () => {
      const result = await setSuggestionVote({ suggestionId: id, selected: next });
      if (!result.ok) {
        setVotes((prev) => ({ ...prev, [id]: current })); // visible rollback
        setError(errorMessage(result.error));
        return;
      }
      setVotes((prev) => ({ ...prev, [id]: { votes: result.data.votes, mine: result.data.selected } }));
      router.refresh();
    });
  }

  function confirm(winnerId: string) {
    setError(null);
    startTransition(async () => {
      const result = await closePlanningRound({ roundId, winningSuggestionId: winnerId });
      if (!result.ok) {
        setError(
          result.error.code === "VALIDATION_ERROR"
            ? "لازم تختار خطة من الأعلى تصويتًا"
            : errorMessage(result.error),
        );
        return;
      }
      router.push(`/groups/${groupId}/events/${result.data.planId}`);
      router.refresh();
    });
  }

  const top = Math.max(0, ...suggestions.map((s) => votes[s.id]?.votes ?? 0));
  const canWin = (id: string) => top === 0 || (votes[id]?.votes ?? 0) === top;

  return (
    <Card variant="flat">
      <div style={{ display: "grid", gap: "var(--space-4)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", flexWrap: "wrap" }}>
          <span style={{ font: "var(--title-md)", color: "var(--text-strong)" }}>
            {formatRange(new Date(windowStartAt), new Date(windowEndAt))}
          </span>
          <Badge tone={availableCount === totalMembers ? "celebrate" : "accent"}>
            {toArabicDigits(availableCount)} من {toArabicDigits(totalMembers)} فاضين
          </Badge>
        </div>

        {error ? <Banner tone="error">{error}</Banner> : null}

        <div style={{ display: "grid", gap: "var(--space-2)" }}>
          {suggestions.map((s) => {
            const v = votes[s.id] ?? { votes: s.votes, mine: s.mine };
            const maps = mapsUrl(s.location);
            return (
              <div
                key={s.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--space-3)",
                  padding: "10px 12px",
                  borderRadius: "var(--radius-md)",
                  background: v.mine ? "var(--accent-quiet)" : "var(--bg-sunken)",
                  border: `2px solid ${v.mine ? "var(--accent)" : "transparent"}`,
                  flexWrap: "wrap",
                }}
              >
                <CategoryIcon category={s.category} size={38} tone={v.mine ? "accent" : "quiet"} />

                <div style={{ display: "grid", gap: 2, flex: 1, minWidth: 120 }}>
                  <span dir="auto" style={{ font: "var(--label-md)", fontWeight: 700, color: "var(--text-strong)" }}>
                    {s.title}
                  </span>
                  <span style={{ font: "var(--body-sm)", color: "var(--text-muted)" }}>
                    {s.suggestedByName}
                    {maps ? (
                      <>
                        {" · "}
                        <a href={maps} target="_blank" rel="noopener noreferrer nofollow">
                          <i className="ph-bold ph-map-pin" aria-hidden="true" /> {locationLabel(s.location)}
                        </a>
                      </>
                    ) : null}
                  </span>
                </div>

                <span
                  style={{
                    fontFamily: "var(--font-display)",
                    fontWeight: 800,
                    fontSize: 20,
                    color: "var(--text-strong)",
                    minWidth: 24,
                    textAlign: "center",
                  }}
                >
                  {toArabicDigits(v.votes)}
                </span>

                <Button tone={v.mine ? "primary" : "outline"} size="sm" onClick={() => toggle(s.id)}>
                  {v.mine ? "✓ مقبولة" : "أقبلها"}
                </Button>

                {viewerIsAdmin ? (
                  <Button
                    tone="secondary"
                    size="sm"
                    disabled={!canWin(s.id)}
                    title={canWin(s.id) ? undefined : "تقدر تختار الأعلى تصويتًا بس"}
                    onClick={() => confirm(s.id)}
                  >
                    ثبّتها
                  </Button>
                ) : null}
              </div>
            );
          })}
        </div>

        <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
          <a
            href={`/groups/${groupId}/plans/${roundId}`}
            style={{ font: "var(--body-sm)", alignSelf: "center" }}
          >
            اقترح خطة أو شوف التفاصيل
          </a>
          {pending ? (
            <span style={{ font: "var(--body-sm)", color: "var(--text-faint)", alignSelf: "center" }}>…</span>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
