"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Banner, EmptyState } from "@/components/ui/card";
import { Input } from "@/components/ui/form";
import { signUp } from "@/lib/actions/auth";
import { errorMessage } from "@/lib/domain/errors";

export function SignUpForm({ next }: { next?: string }) {
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [pending, startTransition] = useTransition();

  function onSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await signUp({
        email: String(formData.get("email") ?? ""),
        password: String(formData.get("password") ?? ""),
        next,
      });
      if (!result.ok) {
        setError(errorMessage(result.error));
        return;
      }
      setSent(true);
    });
  }

  // AUTH-002/AUTH-006: the same confirmation state regardless of whether the
  // address was already registered.
  if (sent) {
    return (
      <EmptyState
        icon={<i className="ph-bold ph-envelope-simple" aria-hidden="true" />}
        title="راجع إيميلك"
        body="أرسلنا لك رابط تأكيد. افتحه وبنكمل التسجيل من عندك."
      />
    );
  }

  return (
    <form action={onSubmit} style={{ display: "grid", gap: "var(--space-5)" }}>
      <h1 style={{ margin: 0, fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 34, color: "var(--text-strong)" }}>
        سو حساب
      </h1>

      {error ? <Banner tone="error">{error}</Banner> : null}

      <Input label="الإيميل" name="email" type="email" dir="ltr" autoComplete="email" required inputMode="email" />
      <Input
        label="كلمة السر"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        hint="٨ حروف على الأقل"
      />

      <Button type="submit" size="lg" block loading={pending}>
        يلا نبدأ
      </Button>

      <div style={{ font: "var(--body-sm)", textAlign: "center" }}>
        <a href={next ? `/auth/sign-in?next=${encodeURIComponent(next)}` : "/auth/sign-in"}>عندي حساب</a>
      </div>
    </form>
  );
}
