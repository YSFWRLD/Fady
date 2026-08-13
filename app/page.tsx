import { LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Wordmark } from "@/components/ui/identity";

/**
 * Public landing page and authentication entry (§5.3). Signed-in visitors are
 * redirected to /home by middleware before this renders.
 */
export default function LandingPage() {
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
      <div style={{ width: "100%", maxWidth: 520, display: "grid", gap: "var(--space-8)" }}>
        <div style={{ display: "grid", gap: "var(--space-4)", justifyItems: "start" }}>
          <Wordmark size={40} />
          <h1
            style={{
              margin: 0,
              fontFamily: "var(--font-display)",
              fontWeight: 800,
              fontSize: "clamp(38px, 9vw, 62px)",
              lineHeight: 0.98,
              color: "var(--text-strong)",
            }}
          >
            متى كلنا فاضين؟
          </h1>
          <p style={{ margin: 0, font: "var(--body-lg)", color: "var(--text-muted)" }}>
            فاضي؟ يخليك تعرف متى أصحابك فاضين وتتفقون على وش تسوون — بدون ما ترجعون تسألون في الواتساب.
          </p>
        </div>

        <Card variant="sticker" tilt="b" tone="celebrate">
          <div style={{ display: "grid", gap: "var(--space-3)" }}>
            <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 26, color: "var(--text-strong)" }}>
              🎉 كلكم فاضين الخميس
            </span>
            <span style={{ font: "var(--body-md)", color: "var(--text-body)" }}>
              حطوا أوقاتكم، والتطبيق يلقى الوقت المشترك، تقترحون خطط، وتصوتون عليها.
            </span>
          </div>
        </Card>

        <div style={{ display: "grid", gap: "var(--space-3)" }}>
          <LinkButton href="/auth/sign-up" tone="primary" size="lg" block>
            سو حساب
          </LinkButton>
          <LinkButton href="/auth/sign-in" tone="quiet" size="lg" block>
            عندي حساب
          </LinkButton>
        </div>

        <p style={{ margin: 0, font: "var(--body-sm)", color: "var(--text-faint)", textAlign: "center" }}>
          كل الأوقات بتوقيت السعودية · بياناتك تشوفها قروباتك بس
        </p>
      </div>
    </main>
  );
}
