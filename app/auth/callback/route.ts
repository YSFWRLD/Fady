import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/auth";

/**
 * Email confirmation and password-recovery callback (§5.3).
 *
 * AUTH-004: `next` carries the pending invite intent through confirmation. It
 * is validated as a same-site relative path, so it can never become an open
 * redirect (§4.3).
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next")) ?? "/home";

  if (!code) {
    return NextResponse.redirect(`${origin}/auth/sign-in?error=missing_code`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(`${origin}/auth/sign-in?error=invalid_code`);
  }

  return NextResponse.redirect(`${origin}${next}`);
}
