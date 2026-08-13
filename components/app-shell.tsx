"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { IconButton } from "@/components/ui/button";
import { Avatar, Wordmark } from "@/components/ui/identity";
import { toArabicDigits } from "@/lib/domain/format";

/** §5.2 — the four recurring destinations. Notifications live in the header. */
const NAV = [
  { id: "home", href: "/home", label: "الرئيسية", icon: "ph-house" },
  { id: "groups", href: "/groups", label: "القروبات", icon: "ph-users-three" },
  { id: "calendar", href: "/calendar", label: "التقويم", icon: "ph-calendar-dots" },
  { id: "profile", href: "/profile", label: "حسابي", icon: "ph-user-circle" },
] as const;

function useActiveTab() {
  const pathname = usePathname();
  if (pathname.startsWith("/groups")) return "groups";
  if (pathname.startsWith("/calendar")) return "calendar";
  if (pathname.startsWith("/profile") || pathname.startsWith("/settings") || pathname.startsWith("/friends"))
    return "profile";
  return "home";
}

/**
 * The theme lives on `<html data-theme>`, set by the blocking script in the root
 * layout before first paint. The app always starts light; only an explicit
 * toggle (persisted in localStorage) switches to dark. Toggling flips the
 * attribute directly, so there is no React state to hydrate. The icon swap is
 * pure CSS (`.fady-icon-light` / `.fady-icon-dark`) for the same reason.
 */
function toggleTheme() {
  const root = document.documentElement;
  const next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
  root.setAttribute("data-theme", next);
  try {
    window.localStorage.setItem("fady-theme", next);
  } catch {
    // Storage can be unavailable in private modes; the toggle still works.
  }
}

function ThemeIcon() {
  return (
    <>
      <i className="ph-bold ph-moon fady-icon-light" aria-hidden="true" />
      <i className="ph-bold ph-sun fady-icon-dark" aria-hidden="true" />
    </>
  );
}

export type ShellUser = { displayName: string; username: string; color: number };
export type ShellGroup = { id: string; name: string; color: number };

function Sidebar({
  active,
  unread,
  user,
  groups,
}: {
  active: string;
  unread: number;
  user: ShellUser;
  groups: ShellGroup[];
}) {
  const router = useRouter();
  return (
    <aside
      className="fady-sidebar"
      style={{
        width: 260,
        flex: "0 0 auto",
        borderInlineEnd: "2px solid var(--border-hairline)",
        background: "var(--bg-page)",
        padding: "var(--space-6) var(--space-5)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-6)",
        position: "sticky",
        top: 0,
        height: "100dvh",
      }}
    >
      <Wordmark size={30} />

      <nav aria-label="التنقل الرئيسي" style={{ display: "grid", gap: 4 }}>
        {NAV.map((it) => {
          const on = it.id === active;
          return (
            <Link
              key={it.id}
              href={it.href}
              aria-current={on ? "page" : undefined}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "var(--space-3)",
                minHeight: 48,
                padding: "0 16px",
                borderRadius: "var(--radius-pill)",
                textDecoration: "none",
                font: "var(--title-sm)",
                fontWeight: on ? 700 : 500,
                background: on ? "var(--accent)" : "transparent",
                color: on ? "var(--text-on-accent)" : "var(--text-body)",
                boxShadow: on ? "var(--shadow-sticker-sm)" : "none",
              }}
            >
              <span style={{ fontSize: 22 }} aria-hidden="true">
                <i className={`${on ? "ph-fill" : "ph-bold"} ${it.icon}`} />
              </span>
              {it.label}
            </Link>
          );
        })}

        <Link
          href="/notifications"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--space-3)",
            minHeight: 48,
            padding: "0 16px",
            borderRadius: "var(--radius-pill)",
            textDecoration: "none",
            font: "var(--title-sm)",
            background: "transparent",
            color: "var(--text-body)",
          }}
        >
          <span style={{ fontSize: 22 }} aria-hidden="true">
            <i className="ph-bold ph-bell" />
          </span>
          الإشعارات
          {unread > 0 ? (
            <span
              style={{
                marginInlineStart: "auto",
                minWidth: 22,
                height: 22,
                padding: "0 6px",
                borderRadius: 999,
                background: "var(--danger)",
                color: "#fff",
                font: "var(--label-sm)",
                fontWeight: 700,
                display: "grid",
                placeItems: "center",
              }}
            >
              {toArabicDigits(unread)}
            </span>
          ) : null}
        </Link>
      </nav>

      {groups.length > 0 ? (
        <div style={{ display: "grid", gap: "var(--space-2)", overflowY: "auto" }}>
          <span style={{ font: "var(--label-sm)", color: "var(--text-faint)", fontWeight: 700, padding: "0 16px" }}>
            قروباتي
          </span>
          {groups.map((g) => (
            <Link
              key={g.id}
              href={`/groups/${g.id}`}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "var(--space-3)",
                minHeight: 44,
                padding: "0 12px",
                borderRadius: "var(--radius-pill)",
                textDecoration: "none",
                font: "var(--label-md)",
                color: "var(--text-body)",
              }}
            >
              <Avatar name={g.name} memberColor={g.color} size="sm" ring={false} />
              {g.name}
            </Link>
          ))}
        </div>
      ) : null}

      <span style={{ flex: 1 }} />

      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
        <button
          type="button"
          onClick={() => router.push("/profile")}
          style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
        >
          <Avatar name={user.displayName} memberColor={user.color} />
          <span style={{ display: "grid", gap: 0, textAlign: "start" }}>
            <span style={{ font: "var(--label-md)", fontWeight: 700, color: "var(--text-strong)" }}>
              {user.displayName}
            </span>
            <span style={{ font: "var(--body-sm)", color: "var(--text-muted)", direction: "ltr" }}>
              @{user.username}
            </span>
          </span>
        </button>
        <span style={{ flex: 1 }} />
        <IconButton tone="quiet" size={36} label="بدّل الوضع الليلي" onClick={toggleTheme} icon={<ThemeIcon />} />
      </div>
    </aside>
  );
}

function BottomNav({ active }: { active: string }) {
  return (
    <nav
      className="fady-bottom-nav"
      aria-label="التنقل الرئيسي"
      style={{
        position: "fixed",
        insetInline: 0,
        bottom: 0,
        zIndex: 20,
        display: "grid",
        gridTemplateColumns: "repeat(4, 1fr)",
        background: "var(--surface-card)",
        borderTop: "2px solid var(--border-hairline)",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
    >
      {NAV.map((it) => {
        const on = it.id === active;
        return (
          <Link
            key={it.id}
            href={it.href}
            aria-current={on ? "page" : undefined}
            style={{
              minHeight: "var(--bottom-nav-h)",
              display: "grid",
              gap: 2,
              placeItems: "center",
              textDecoration: "none",
              color: on ? "var(--accent)" : "var(--text-faint)",
            }}
          >
            <span style={{ fontSize: 24 }} aria-hidden="true">
              <i className={`${on ? "ph-fill" : "ph-bold"} ${it.icon}`} />
            </span>
            <span style={{ font: "var(--label-sm)", fontWeight: on ? 700 : 500 }}>{it.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

/**
 * §8.7 — mobile is the primary design: a fixed header and bottom nav below
 * 900px, a sidebar and centred feed above it, with an optional contextual rail
 * on wide screens.
 */
export function AppShell({
  children,
  rail,
  title,
  lede,
  back,
  unread,
  user,
  groups,
}: {
  children: ReactNode;
  rail?: ReactNode;
  title?: string;
  lede?: string;
  back?: string;
  unread: number;
  user: ShellUser;
  groups: ShellGroup[];
}) {
  const active = useActiveTab();

  return (
    <div style={{ display: "flex", minHeight: "100dvh", background: "var(--bg-page)" }}>
      <Sidebar active={active} unread={unread} user={user} groups={groups} />

      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <header
          className="fady-mobile-header"
          style={{
            position: "sticky",
            top: 0,
            zIndex: 10,
            minHeight: "var(--header-h)",
            display: "flex",
            alignItems: "center",
            gap: "var(--space-2)",
            padding: "0 var(--gutter)",
            background: "color-mix(in oklab, var(--bg-page) 88%, transparent)",
            backdropFilter: "blur(12px)",
            borderBottom: "1px solid var(--border-hairline)",
          }}
        >
          {back ? (
            <Link
              href={back}
              aria-label="رجوع"
              style={{ color: "var(--text-body)", fontSize: 22, display: "grid", placeItems: "center", width: 44, height: 44 }}
            >
              <i className="ph-bold ph-arrow-right" aria-hidden="true" />
            </Link>
          ) : (
            <Wordmark />
          )}
          <span style={{ flex: 1 }} />
          <IconButton tone="plain" size={40} label="بدّل الوضع الليلي" onClick={toggleTheme} icon={<ThemeIcon />} />
          <Link
            href="/notifications"
            aria-label="الإشعارات"
            style={{ position: "relative", color: "var(--text-body)", fontSize: 22, display: "grid", placeItems: "center", width: 44, height: 44 }}
          >
            <i className="ph-bold ph-bell" aria-hidden="true" />
            {unread > 0 ? (
              <span
                style={{
                  position: "absolute",
                  top: 4,
                  insetInlineEnd: 2,
                  minWidth: 18,
                  height: 18,
                  padding: "0 5px",
                  borderRadius: 999,
                  background: "var(--danger)",
                  color: "#fff",
                  font: "var(--label-sm)",
                  fontWeight: 700,
                  display: "grid",
                  placeItems: "center",
                  border: "2px solid var(--bg-page)",
                }}
              >
                {toArabicDigits(unread)}
              </span>
            ) : null}
          </Link>
        </header>

        <main
          style={{
            flex: 1,
            display: "flex",
            justifyContent: "center",
            gap: "var(--space-8)",
            padding: "var(--space-6) var(--gutter)",
            paddingBottom: "calc(var(--bottom-nav-h) + var(--space-8))",
          }}
        >
          <div style={{ width: "100%", maxWidth: 640, display: "grid", gap: "var(--space-6)", alignContent: "start" }}>
            {title ? (
              <div style={{ display: "grid", gap: "var(--space-2)" }}>
                <h1
                  style={{
                    margin: 0,
                    fontFamily: "var(--font-display)",
                    fontWeight: 800,
                    fontSize: "clamp(30px, 6vw, 46px)",
                    lineHeight: 1.02,
                    color: "var(--text-strong)",
                  }}
                >
                  {title}
                </h1>
                {lede ? <p style={{ margin: 0, font: "var(--body-lg)", color: "var(--text-muted)" }}>{lede}</p> : null}
              </div>
            ) : null}
            {children}
          </div>

          {rail ? (
            <div
              className="fady-rail"
              style={{ width: 300, flex: "0 0 auto", display: "grid", gap: "var(--space-4)", alignContent: "start" }}
            >
              {rail}
            </div>
          ) : null}
        </main>
      </div>

      <BottomNav active={active} />
    </div>
  );
}

export function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section style={{ display: "grid", gap: "var(--space-3)" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: "var(--space-3)" }}>
        <h2 style={{ margin: 0, fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 24, color: "var(--text-strong)" }}>
          {title}
        </h2>
        <span style={{ flex: 1 }} />
        {action}
      </div>
      {children}
    </section>
  );
}

