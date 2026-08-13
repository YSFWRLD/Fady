"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Banner, Card } from "@/components/ui/card";
import { Input } from "@/components/ui/form";
import { Wordmark } from "@/components/ui/identity";
import { completeProfile } from "@/lib/actions/profile";
import { createGroup } from "@/lib/actions/groups";
import { errorMessage } from "@/lib/domain/errors";
import { toArabicDigits } from "@/lib/domain/format";

type Step = "welcome" | "profile" | "friends" | "group" | "availability";

const STEP_ORDER: Step[] = ["welcome", "profile", "friends", "group", "availability"];

export function OnboardingWizard({
  initialDisplayName,
  initialUsername,
  profileDone,
  hasPendingInvite,
  firstGroup,
}: {
  initialDisplayName: string;
  initialUsername: string;
  profileDone: boolean;
  hasPendingInvite: boolean;
  firstGroup: { id: string; name: string } | null;
}) {
  const router = useRouter();
  const [step, setStep] = useState<Step>(profileDone ? "friends" : "welcome");
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [group, setGroup] = useState(firstGroup);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const index = STEP_ORDER.indexOf(step);

  function saveProfile(formData: FormData) {
    setError(null);
    setFieldError(null);
    startTransition(async () => {
      const result = await completeProfile({
        displayName: String(formData.get("displayName") ?? ""),
        username: String(formData.get("username") ?? ""),
      });
      if (!result.ok) {
        if (result.error.field === "username") setFieldError("اسم المستخدم مستخدم");
        else setError(errorMessage(result.error));
        return;
      }
      // PRO-006: a preserved invite comes before creating a group.
      setStep(hasPendingInvite ? "group" : "friends");
      router.refresh();
    });
  }

  function makeGroup(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await createGroup({ name: String(formData.get("name") ?? "") });
      if (!result.ok) {
        setError(errorMessage(result.error));
        return;
      }
      setGroup({ id: result.data.groupId, name: String(formData.get("name") ?? "") });
      setInviteUrl(result.data.inviteUrl);
      setStep("availability");
      router.refresh();
    });
  }

  function finish() {
    // PRO-007: availability education runs on a real group, or is skipped.
    router.push(group ? `/groups/${group.id}/availability` : "/home");
    router.refresh();
  }

  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "grid",
        placeItems: "center",
        padding: "var(--space-8) var(--gutter)",
        background: "var(--bg-page)",
      }}
    >
      <div style={{ width: "100%", maxWidth: 460, display: "grid", gap: "var(--space-6)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
          <Wordmark size={30} />
          <span style={{ flex: 1 }} />
          <span style={{ font: "var(--label-sm)", color: "var(--text-faint)" }}>
            {toArabicDigits(index + 1)} من {toArabicDigits(STEP_ORDER.length)}
          </span>
        </div>

        {error ? <Banner tone="error">{error}</Banner> : null}

        {step === "welcome" ? (
          <>
            <Card variant="sticker" tilt="b" tone="celebrate">
              <div style={{ display: "grid", gap: "var(--space-3)" }}>
                <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 30, lineHeight: 1.05, color: "var(--text-strong)" }}>
                  هلا فيك 👋
                </span>
                <span style={{ font: "var(--body-md)", color: "var(--text-body)" }}>
                  حط وقتك، شوف متى القروب فاضي، واتفقوا على الخطة — كل شي في مكان واحد.
                </span>
              </div>
            </Card>
            <Button size="lg" block onClick={() => setStep("profile")}>
              يلا نبدأ
            </Button>
          </>
        ) : null}

        {step === "profile" ? (
          <form action={saveProfile} style={{ display: "grid", gap: "var(--space-5)" }}>
            <h1 style={{ margin: 0, fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 30, color: "var(--text-strong)" }}>
              عرّفنا بنفسك
            </h1>
            <Input label="اسمك" name="displayName" defaultValue={initialDisplayName} maxLength={50} required />
            <Input
              label="اسم المستخدم"
              name="username"
              defaultValue={initialUsername}
              dir="ltr"
              prefix="@"
              maxLength={20}
              required
              error={fieldError ?? undefined}
              hint="حروف إنجليزية وأرقام و _ فقط"
            />
            <Button type="submit" size="lg" block loading={pending}>
              كمّل
            </Button>
          </form>
        ) : null}

        {step === "friends" ? (
          <>
            <h1 style={{ margin: 0, fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 30, color: "var(--text-strong)" }}>
              أضف أصحابك
            </h1>
            <p style={{ margin: 0, font: "var(--body-md)", color: "var(--text-muted)" }}>
              دوّر أصحابك باليوزر، أو تخطّاها وضيفهم بعدين.
            </p>
            <div style={{ display: "grid", gap: "var(--space-3)" }}>
              <Button size="lg" block onClick={() => router.push("/friends")}>
                دوّر أصدقاء
              </Button>
              <Button tone="quiet" size="lg" block onClick={() => setStep("group")}>
                تخطّى
              </Button>
            </div>
          </>
        ) : null}

        {step === "group" ? (
          <>
            <h1 style={{ margin: 0, fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 30, color: "var(--text-strong)" }}>
              {hasPendingInvite ? "عندك دعوة قروب" : "سو أول قروب"}
            </h1>

            {hasPendingInvite ? (
              <div style={{ display: "grid", gap: "var(--space-3)" }}>
                <Card variant="flat" tone="quiet">
                  <span style={{ font: "var(--body-md)", color: "var(--text-body)" }}>
                    جاك رابط قروب — انضم له قبل لا تسوي قروب جديد.
                  </span>
                </Card>
                <Button size="lg" block onClick={() => router.push("/join")}>
                  انضم للقروب
                </Button>
                <Button tone="quiet" size="lg" block onClick={() => setStep("availability")}>
                  بعدين
                </Button>
              </div>
            ) : (
              <form action={makeGroup} style={{ display: "grid", gap: "var(--space-4)" }}>
                <Input label="اسم القروب" name="name" placeholder="الشباب" maxLength={40} required />
                <Button type="submit" size="lg" block loading={pending}>
                  سو قروب
                </Button>
                <Button tone="quiet" size="lg" block onClick={() => setStep("availability")}>
                  تخطّى
                </Button>
              </form>
            )}
          </>
        ) : null}

        {step === "availability" ? (
          <>
            <h1 style={{ margin: 0, fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 30, color: "var(--text-strong)" }}>
              {group ? "آخر خطوة — حط وقتك" : "كل شي جاهز"}
            </h1>
            <p style={{ margin: 0, font: "var(--body-md)", color: "var(--text-muted)" }}>
              {group
                ? `اختر الأوقات اللي تكون فيها فاضي في ${group.name}، وبنلقى لكم الوقت المشترك.`
                : "تقدر تسوي قروب أو تنضم لواحد في أي وقت."}
            </p>

            {inviteUrl ? (
              <Card variant="flat" tone="quiet">
                <div style={{ display: "grid", gap: "var(--space-2)" }}>
                  <span style={{ font: "var(--label-md)", fontWeight: 700, color: "var(--text-strong)" }}>
                    رابط دعوة القروب
                  </span>
                  <span style={{ font: "var(--mono-sm)", color: "var(--text-muted)", direction: "ltr", wordBreak: "break-all" }}>
                    {inviteUrl}
                  </span>
                </div>
              </Card>
            ) : null}

            <Button size="lg" block onClick={finish}>
              {group ? "حط وقتك" : "روح للرئيسية"}
            </Button>
          </>
        ) : null}
      </div>
    </main>
  );
}
