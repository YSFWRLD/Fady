import type { NextConfig } from "next";

/**
 * BR-008 / §9.10 security: user content is never rendered as HTML, and the CSP
 * below keeps the app from loading or connecting anywhere except Supabase.
 * `connect-src` is widened at runtime with the configured Supabase origin so
 * auth, PostgREST, Storage, and Realtime (wss) keep working.
 */
const supabaseOrigin = (() => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return "";
  try {
    const { origin, host } = new URL(url);
    return `${origin} wss://${host}`;
  } catch {
    return "";
  }
})();

const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "img-src 'self' blob: data:" + (supabaseOrigin ? ` ${supabaseOrigin.split(" ")[0]}` : ""),
  "font-src 'self' data:",
  // Next.js injects inline bootstrap scripts; styles are inline design tokens.
  "script-src 'self' 'unsafe-inline'" + (process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""),
  "style-src 'self' 'unsafe-inline'",
  `connect-src 'self' ${supabaseOrigin}`.trim(),
].join("; ");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
