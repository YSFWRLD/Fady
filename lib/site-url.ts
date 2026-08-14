import "server-only";

import { headers } from "next/headers";

/**
 * The absolute origin to build shareable links from.
 *
 * This exists because share links were rendering as `/join/<token>` in
 * production: the code read `NEXT_PUBLIC_SITE_URL` directly, and that variable
 * was never set on the deployment, so the origin came out empty. Relying on one
 * hand-configured variable is too fragile for something every invite depends
 * on, so resolution now falls through four sources:
 *
 *   1. NEXT_PUBLIC_SITE_URL — explicit, wins when set (custom domain).
 *   2. VERCEL_PROJECT_PRODUCTION_URL — the project's stable production domain,
 *      injected by Vercel automatically. Correct even on preview deployments.
 *   3. VERCEL_URL — this specific deployment's URL.
 *   4. The request's Host header — local dev, and any other host.
 *
 * Only the last is attacker-influenceable, and it ranks last precisely so a
 * forged Host cannot displace a configured origin.
 */
export async function siteOrigin(): Promise<string> {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured) return stripTrailingSlash(withProtocol(configured));

  const productionUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (productionUrl) return stripTrailingSlash(withProtocol(productionUrl));

  const deploymentUrl = process.env.VERCEL_URL?.trim();
  if (deploymentUrl) return stripTrailingSlash(withProtocol(deploymentUrl));

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (isLocal(host) ? "http" : "https");
  return stripTrailingSlash(`${proto}://${host}`);
}

/** Builds an absolute app URL from a root-relative path. */
export async function absoluteUrl(path: string): Promise<string> {
  const origin = await siteOrigin();
  return `${origin}${path.startsWith("/") ? path : `/${path}`}`;
}

function withProtocol(value: string): string {
  if (/^https?:\/\//i.test(value)) return value;
  return `${isLocal(value) ? "http" : "https"}://${value}`;
}

function isLocal(host: string): boolean {
  return host.startsWith("localhost") || host.startsWith("127.0.0.1");
}

function stripTrailingSlash(value: string): string {
  return value.replace(/\/$/, "");
}
