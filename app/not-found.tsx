import { LinkButton } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/card";
import { Wordmark } from "@/components/ui/identity";

/**
 * §5.3 — one neutral state for unknown ids, deleted entities, and resources the
 * viewer is not a member of, so the page never confirms that a private resource
 * exists.
 */
export default function NotFound() {
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
      <div style={{ width: "100%", maxWidth: 420, display: "grid", gap: "var(--space-6)", justifyItems: "center" }}>
        <Wordmark size={32} />
        <EmptyState
          icon={<i className="ph-bold ph-compass" aria-hidden="true" />}
          title="ما لقينا الصفحة"
          body="يمكن الرابط قديم، أو ما عاد عندك وصول لهذا المحتوى."
          action={<LinkButton href="/home">الرئيسية</LinkButton>}
        />
      </div>
    </main>
  );
}
