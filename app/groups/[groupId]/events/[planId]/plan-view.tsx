"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Section } from "@/components/app-shell";
import { ShareButton } from "@/components/share-button";
import { Button } from "@/components/ui/button";
import { Badge, Banner, Card } from "@/components/ui/card";
import { Avatar, CategoryIcon } from "@/components/ui/identity";
import { cancelConfirmedPlan, respondAttendance } from "@/lib/actions/plans";
import { errorMessage } from "@/lib/domain/errors";
import { formatDayLong, formatRange, toArabicDigits } from "@/lib/domain/format";
import { locationLabel, mapsUrl } from "@/lib/domain/maps";
import type { AttendanceStatus, ConfirmedPlanStatus, PlanCategory } from "@/lib/domain/types";

type Plan = {
  id: string;
  groupId: string;
  groupName: string;
  category: PlanCategory;
  title: string;
  description: string | null;
  location: string | null;
  externalUrl: string | null;
  startAt: string;
  endAt: string;
  status: ConfirmedPlanStatus;
  cancellationReason: string | null;
  viewerIsAdmin: boolean;
  myStatus: AttendanceStatus | null;
  attendees: { userId: string; name: string; color: number; status: AttendanceStatus }[];
};

export function PlanView({ plan, origin }: { plan: Plan; origin: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [myStatus, setMyStatus] = useState<AttendanceStatus | null>(plan.myStatus);
  const [pending, startTransition] = useTransition();

  function respond(status: "going" | "not_going") {
    const previous = myStatus;
    setMyStatus(status); // §8.5: RSVP updates optimistically.
    setError(null);

    startTransition(async () => {
      const result = await respondAttendance({ planId: plan.id, status });
      if (!result.ok) {
        setMyStatus(previous);
        setError(errorMessage(result.error));
        return;
      }
      router.refresh();
    });
  }

  function cancelPlan(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await cancelConfirmedPlan({
        planId: plan.id,
        reason: String(formData.get("reason") ?? "") || null,
      });
      if (!result.ok) setError(errorMessage(result.error));
      else router.refresh();
    });
  }

  const going = plan.attendees.filter((a) => a.status === "going");
  const notGoing = plan.attendees.filter((a) => a.status === "not_going");
  const undecided = plan.attendees.filter((a) => a.status === "pending");
  const cancelled = plan.status === "cancelled";

  return (
    <div style={{ display: "grid", gap: "var(--space-6)" }}>
      <Card variant="sticker" tilt="a" tone={cancelled ? "quiet" : "celebrate"}>
        <div style={{ display: "grid", gap: "var(--space-4)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
            <CategoryIcon category={plan.category} size={60} tone={cancelled ? "quiet" : "accent"} />
            <div style={{ display: "grid", gap: 4, flex: 1, minWidth: 0 }}>
              <span
                dir="auto"
                style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 28, color: "var(--text-strong)" }}
              >
                {plan.title}
              </span>
              <span style={{ font: "var(--body-md)", color: "var(--text-muted)" }}>{plan.groupName}</span>
            </div>
            <Badge tone={cancelled ? "danger" : "celebrate"}>{cancelled ? "انلغت" : "الخطة ثبتت"}</Badge>
          </div>

          <div style={{ display: "grid", gap: 2 }}>
            <span style={{ font: "var(--title-sm)", color: "var(--text-strong)" }}>{formatDayLong(new Date(plan.startAt))}</span>
            <span style={{ font: "var(--body-md)", color: "var(--text-body)" }}>
              {formatRange(new Date(plan.startAt), new Date(plan.endAt))} · بتوقيت السعودية
            </span>
          </div>

          {plan.description ? (
            <span dir="auto" style={{ font: "var(--body-md)", color: "var(--text-body)" }}>
              {plan.description}
            </span>
          ) : null}
          {plan.location ? (
            <a
              href={mapsUrl(plan.location) ?? undefined}
              target="_blank"
              rel="noopener noreferrer nofollow"
              dir="auto"
              style={{ font: "var(--body-md)", fontWeight: 700 }}
            >
              <i className="ph-bold ph-map-pin" aria-hidden="true" /> {locationLabel(plan.location)}
            </a>
          ) : null}
          {plan.externalUrl ? (
            <a href={plan.externalUrl} target="_blank" rel="noopener noreferrer nofollow" dir="ltr" style={{ font: "var(--body-sm)" }}>
              {plan.externalUrl}
            </a>
          ) : null}
        </div>
      </Card>

      {cancelled ? (
        <Banner tone="info">
          {plan.cancellationReason ? `الخطة انلغت: ${plan.cancellationReason}` : "الخطة انلغت."}
        </Banner>
      ) : null}

      {error ? <Banner tone="error">{error}</Banner> : null}

      {!cancelled && plan.status === "scheduled" ? (
        <Card variant="flat">
          <div style={{ display: "grid", gap: "var(--space-3)" }}>
            <span style={{ font: "var(--title-sm)", color: "var(--text-strong)" }}>بتجي؟</span>
            <div style={{ display: "flex", gap: "var(--space-2)" }}>
              <Button tone={myStatus === "going" ? "primary" : "outline"} onClick={() => respond("going")} loading={pending && myStatus === "going"}>
                أكيد
              </Button>
              <Button tone={myStatus === "not_going" ? "danger" : "outline"} onClick={() => respond("not_going")}>
                ما أقدر
              </Button>
            </div>
            {/* CNF-005: availability and votes never set attendance. */}
            <span style={{ font: "var(--body-sm)", color: "var(--text-muted)" }}>
              ردك ما يتغير إلا لما تغيّره أنت، وتقدر تعدله قبل الخطة.
            </span>
          </div>
        </Card>
      ) : null}

      <Section title="مين جاي">
        <Card variant="flat">
          <div style={{ display: "grid", gap: "var(--space-4)" }}>
            <AttendeeGroup label={`جايين (${toArabicDigits(going.length)})`} people={going} />
            <AttendeeGroup label={`ما ردوا (${toArabicDigits(undecided.length)})`} people={undecided} />
            <AttendeeGroup label={`ما يقدرون (${toArabicDigits(notGoing.length)})`} people={notGoing} />
          </div>
        </Card>
      </Section>

      {!cancelled ? (
        <ShareButton
          url={`${origin}/groups/${plan.groupId}/events/${plan.id}`}
          text={`${plan.title} — ${formatRange(new Date(plan.startAt), new Date(plan.endAt))}`}
          label="شارك الخطة"
        />
      ) : null}

      {plan.viewerIsAdmin && plan.status === "scheduled" ? (
        <Card variant="flat" tone="quiet">
          <form action={cancelPlan} style={{ display: "grid", gap: "var(--space-3)" }}>
            <span style={{ font: "var(--title-sm)", color: "var(--text-strong)" }}>ألغِ الخطة</span>
            <input
              name="reason"
              maxLength={250}
              placeholder="السبب (اختياري)"
              dir="auto"
              style={{
                minHeight: 44,
                borderRadius: "var(--radius-md)",
                border: "2px solid var(--border-hairline)",
                background: "var(--surface-card)",
                color: "var(--text-strong)",
                font: "var(--body-md)",
                padding: "0 12px",
              }}
            />
            <Button type="submit" tone="danger" size="sm" loading={pending}>
              ألغِ الخطة
            </Button>
          </form>
        </Card>
      ) : null}
    </div>
  );
}

function AttendeeGroup({
  label,
  people,
}: {
  label: string;
  people: { userId: string; name: string; color: number }[];
}) {
  if (people.length === 0) return null;
  return (
    <div style={{ display: "grid", gap: "var(--space-2)" }}>
      <span style={{ font: "var(--label-sm)", color: "var(--text-muted)", fontWeight: 700 }}>{label}</span>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-3)" }}>
        {people.map((p) => (
          <span key={p.userId} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <Avatar name={p.name} memberColor={p.color} size="sm" ring={false} />
            <span style={{ font: "var(--label-md)", color: "var(--text-body)" }}>{p.name}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
