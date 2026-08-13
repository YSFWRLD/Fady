"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

/**
 * §4.3 — an invite token is held as a short-lived, same-site, httpOnly pending
 * intent. It is never placed in a redirect parameter, so it cannot leak through
 * a Referer header, browser history, or an open-redirect chain.
 */
const INVITE_COOKIE = "fady_invite";
const FRIEND_COOKIE = "fady_friend_invite";
const TEN_MINUTES = 60 * 10;

const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: TEN_MINUTES,
};

export async function storeInviteIntent(token: string, destination: "sign-up" | "sign-in") {
  if (!/^[a-f0-9]{16,64}$/.test(token)) redirect("/join");

  const store = await cookies();
  store.set(INVITE_COOKIE, token, cookieOptions);
  // `next` points at the token-free page, which reads the cookie back.
  redirect(`/auth/${destination}?next=${encodeURIComponent("/join")}`);
}

export async function readInviteIntent(): Promise<string | null> {
  const store = await cookies();
  return store.get(INVITE_COOKIE)?.value ?? null;
}

export async function clearInviteIntent() {
  const store = await cookies();
  store.delete(INVITE_COOKIE);
}

/** §4.4 — the same treatment for a friend invite's username. */
export async function storeFriendIntent(username: string, destination: "sign-up" | "sign-in") {
  if (!/^[a-z0-9_]{3,20}$/.test(username)) redirect("/friends");

  const store = await cookies();
  store.set(FRIEND_COOKIE, username, cookieOptions);
  redirect(`/auth/${destination}?next=${encodeURIComponent(`/invite/${username}`)}`);
}

export async function readFriendIntent(): Promise<string | null> {
  const store = await cookies();
  return store.get(FRIEND_COOKIE)?.value ?? null;
}

export async function clearFriendIntent() {
  const store = await cookies();
  store.delete(FRIEND_COOKIE);
}
