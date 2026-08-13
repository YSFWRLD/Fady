import type { ReactNode } from "react";
import Link from "next/link";
import { Wordmark } from "@/components/ui/identity";

export default function AuthLayout({ children }: { children: ReactNode }) {
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
      <div style={{ width: "100%", maxWidth: 420, display: "grid", gap: "var(--space-6)" }}>
        <Link href="/" style={{ textDecoration: "none", justifySelf: "start" }}>
          <Wordmark size={32} />
        </Link>
        {children}
      </div>
    </main>
  );
}
