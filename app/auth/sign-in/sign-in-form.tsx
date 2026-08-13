"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Banner } from "@/components/ui/card";
import { Input } from "@/components/ui/form";
import { signIn } from "@/lib/actions/auth";
import { errorMessage } from "@/lib/domain/errors";

export function SignInForm({ next }: { next?: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await signIn({
        email: String(formData.get("email") ?? ""),
        password: String(formData.get("password") ?? ""),
        next,
      });
      // AUTH-006: one message for both a wrong password and an unknown email.
      if (!result.ok) {
        setError(
          result.error.code === "UNAUTHENTICATED" ? "الإيميل أو كلمة السر غلط" : errorMessage(result.error),
        );
        return;
      }
      router.push(result.data.next);
      router.refresh();
    });
  }

  return (
    <form action={onSubmit} style={{ display: "grid", gap: "var(--space-5)" }}>
      <h1 style={{ margin: 0, fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 34, color: "var(--text-strong)" }}>
        أهلاً مرة ثانية
      </h1>

      {error ? <Banner tone="error">{error}</Banner> : null}

      <Input label="الإيميل" name="email" type="email" dir="ltr" autoComplete="email" required inputMode="email" />
      <Input label="كلمة السر" name="password" type="password" autoComplete="current-password" required />

      <Button type="submit" size="lg" block loading={pending}>
        دخول
      </Button>

      <div style={{ display: "flex", justifyContent: "space-between", font: "var(--body-sm)" }}>
        <a href="/auth/forgot-password">نسيت كلمة السر</a>
        <a href={next ? `/auth/sign-up?next=${encodeURIComponent(next)}` : "/auth/sign-up"}>سو حساب</a>
      </div>
    </form>
  );
}
