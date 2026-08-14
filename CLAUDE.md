# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**فاضي؟ (romanized "Fady")** — an Arabic-first, RTL, mobile-first social planning app for
Saudi friend groups. The loop is: *friends → groups → availability → overlap → suggest →
vote → confirm → RSVP*.

Two source documents drive everything and are worth consulting before non-trivial work:

- **`fadhi-prd.md`** — the full MVP product spec. Requirements are numbered (`AVL-007`,
  `VOT-004`, `OVL-010`, `CNF-003`, …) and the code cites those IDs in comments. When you
  change behaviour, find the requirement first; when you deviate, say so explicitly.
- **`Fadhi Web App.html`** — the approved visual prototype. The design system in
  `app/globals.css` and `components/ui/` was ported from it verbatim. Don't reinvent the
  look; match it.

Both keep their original `fadhi-` filenames. Everything else uses **`fady`** (package name,
CSS classes `fady-*`, cookies `fady_invite`, `localStorage` key `fady-theme`).

## Commands

```bash
npm run dev         # dev server on :3000
npm run build       # production build
npm run typecheck   # tsc --noEmit
npm run lint        # eslint
npm test            # vitest run
```

Run a single test file or case:

```bash
npx vitest run lib/domain/overlap.test.ts
npx vitest run -t "merges adjacent blocks"
```

Before committing, run `npm run typecheck && npm run lint && npm test && npm run build`.
The lint config is strict about React rules — in particular `react-hooks/set-state-in-effect`
will reject `setState` inside an effect body. See "Client-side gotchas" below.

## The security model — read this before touching the database

**Authorization lives entirely in Postgres.** There is no application-layer permission
check to fall back on. Two mechanisms carry it:

1. **RLS policies** (`0002_rls.sql`) gate every table.
2. **`SECURITY DEFINER` RPCs** (`0003_rpc.sql`) perform every mutation. They run as the
   table owner, so RLS does *not* apply to them — each one re-derives `auth.uid()` via
   `require_uid()` and re-checks membership/role itself. Never trust an RPC argument.

**Clients cannot write tables directly.** `0007` revokes all `INSERT/UPDATE/DELETE` from
`anon` and `authenticated`, because Supabase grants those by default and RLS `WITH CHECK`
clauses that name only an owner column still permit rewriting every other column —
including foreign keys. The single exception is a column-scoped
`grant update (name, image_path) on groups`, which `updateGroup` uses.

Consequences for new work:

- A new mutation goes in an RPC, not a `.from().insert()`.
- A new table needs RLS enabled *and* the client write grants revoked (the
  `alter default privileges` in `0007` covers future tables, but verify).
- Every `SECURITY DEFINER` function must `set search_path = ''` and schema-qualify
  everything (`public.`, `extensions.`).
- After schema changes run the advisors and check nothing regressed:
  `get_advisors` with `type: "security"` via the Supabase MCP.

Migrations are applied to the live project via the Supabase MCP `apply_migration`, and the
matching `.sql` file is written to `supabase/migrations/` so the repo mirrors the applied
history. Keep both in sync.

### Bugs this layer has already produced

Two real failures came from exactly these mechanics, both fixed and worth not repeating:

- A `RETURNS TABLE` output column shadowed a real column inside `ON CONFLICT (...)`,
  raising `42702` and making **every vote fail** (`0006`). Avoid naming output columns
  after table columns you reference in DML.
- `active_member_count(gid)` was callable by `anon` over `/rest/v1/rpc/`, leaking a private
  group's member count to anyone holding a UUID — contradicting BR-005 (`0005`).

## Architecture

### Layers

```
app/**/page.tsx        Server Components. Fetch via lib/data/queries.ts, render.
components/*.tsx       Client Components. Call server actions, hold optimistic state.
lib/actions/*.ts       "use server". Validate with Zod, call RPCs, revalidate paths.
lib/data/queries.ts    Server-only reads. Run under the caller's session, so RLS applies.
lib/domain/*.ts        Pure logic. No I/O, no Supabase. Unit-testable.
supabase/migrations/   Schema, RLS, RPCs. The real authorization boundary.
```

The rule that keeps this honest: **`lib/domain` never imports Supabase.** The overlap
engine is pure functions over intervals, which is why it has real tests.

### The overlap engine

`lib/domain/overlap.ts` implements PRD §9.7 — a boundary sweep that merges each member's
intervals, emits segments with their available-member set, discards anything under 60
minutes, and ranks by full-match → count → duration → earliest start. Overlaps are
**derived on read, never stored** (OVL-001).

This is the product's core algorithm and the one place with meaningful test coverage
(`overlap.test.ts`, 15 cases derived from the PRD's own acceptance criteria, including
midnight-crossing intervals and the boundary case where one member replaces another).
Change it only with tests.

### Server action contract

All actions return `ActionResult<T>` from `lib/domain/errors.ts` — a stable English error
code, never raw database text. The client maps codes to Saudi Arabic copy via
`errorMessage()`. RPCs `raise exception 'GROUP_FULL'` and similar; `mapPostgresError()`
translates them back.

### Time

Everything is stored UTC and rendered in Saudi time. `lib/domain/format.ts` does this with
a fixed +03:00 offset (Saudi Arabia has never observed DST) rather than a timezone library.
Arabic-Indic digits, 12-hour clock with ص/م, Gregorian only.

The IANA id `Asia/Riyadh` stays in code and the DB check constraint, but **user-facing copy
says بتوقيت السعودية, not الرياض** — a deliberate deviation from PRD §8.6 at the owner's
request.

### Auth and routing

`proxy.ts` (Next 16's renamed middleware) refreshes the session and enforces two rules:
AUTH-004 (a pending invite survives sign-up) and AUTH-005 (no completed profile → forced to
`/onboarding`). Invite tokens ride in a short-lived httpOnly cookie
(`lib/actions/invite-intent.ts`), never a redirect parameter.

Absolute URLs come from `lib/site-url.ts`, which falls through
`NEXT_PUBLIC_SITE_URL` → `VERCEL_PROJECT_PRODUCTION_URL` → `VERCEL_URL` → request host.
Never read `NEXT_PUBLIC_SITE_URL` directly — that produced relative `/join/<token>` links in
production when the variable was unset.

### Realtime

`components/live-refresh.tsx` subscribes app-wide and calls `router.refresh()`, debounced
400ms because one confirm writes a round, a plan, N attendees and N notifications.
`components/notification-popups.tsx` raises toasts plus native browser notifications.

Payloads are **signals only** — never trusted as data. The refresh re-reads under RLS.
Real Web Push (closed browser) is not implemented; it needs a service worker and VAPID.

## Client-side gotchas

- **Design tokens, not Tailwind utilities.** Components use inline styles referencing CSS
  variables (`var(--accent)`, `var(--space-4)`, `var(--title-md)`). Tailwind is present but
  the ported design system is the source of truth.
- **Theme:** always opens light. The OS `prefers-color-scheme` is deliberately ignored; the
  blocking script in `app/layout.tsx` sets `data-theme` before paint, and the toggle flips
  the attribute directly — no React state, so no hydration mismatch.
- **Never branch on `typeof window`** to build rendered output. Doing so for a share URL
  caused a hydration mismatch; resolve server-side and pass down as a prop.
- **Syncing state from props:** adjust during render (compare a "seen" value and `setState`)
  rather than in an effect — the lint rule rejects the effect form. See `InlineVoteCard`.
- **External browser state** (notification permission) uses `useSyncExternalStore`, not an
  effect.

## Environment

`.env.local` (gitignored) needs `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`, `NEXT_PUBLIC_SITE_URL`. See `.env.example`.

The service-role client (`lib/supabase/admin.ts`) is `import "server-only"` and used in
exactly two places: notification fan-out to other members, and the cron job. It bypasses
RLS — never import it into a client component.

## Known constraints

- **Supabase built-in email is capped at 2/hour project-wide** and the limit is not
  raisable in the dashboard. This blocks real signups; custom SMTP is required. The
  `EMAIL_SEND_LIMIT` error code exists to say the failure is ours, not the user's.
- **Vercel Hobby allows only daily cron**, so `/api/cron` runs daily and `0008` widened the
  reminder window to 48 hours. Exact 24-hour reminders (NOT-007) need an hourly schedule.
- Leaked-password protection could not be enabled — likely plan-gated.
