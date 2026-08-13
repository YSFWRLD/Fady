# فاضي؟

Saudi-first social planning for persistent friend and family groups.

**Friends → Groups → Availability → Overlap → Suggest → Vote → Confirm → Repeat**

Romanized **Fady**. Arabic-first, RTL, mobile-first. Built to `fadhi-prd.md`
(MVP v1.0) with the visual language of the approved prototype in
`Fadhi Web App.html`. (Those two source files keep their original filenames; the
product name in the app is Fady.)

| | |
|---|---|
| Stack | Next.js 16 (App Router) · TypeScript · Tailwind 4 · Supabase · Vercel |
| Timezone | Saudi time — IANA `Asia/Riyadh`, fixed for MVP (BR-002). UI copy says **بتوقيت السعودية**, not الرياض. |
| Theme | Always opens light; dark only via the toggle, persisted in `localStorage` under `fady-theme` |
| Language | Arabic only, `<html lang="ar" dir="rtl">` (§8.6) |

---

## 1. Setup

### 1.1 Environment

Copy `.env.example` to `.env.local` and fill it from your Supabase project
(**Project Settings → API**):

```bash
cp .env.example .env.local
```

| Variable | Where it comes from |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `anon` / publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | `service_role` key — **server-only**, never commit |
| `CRON_SECRET` | Any long random string you generate |
| `NEXT_PUBLIC_SITE_URL` | `http://localhost:3000` locally; the deployed origin in production |

### 1.2 Database

**Already applied to the `Fady` project (`epzuhspvrretvmfgpash`).** For a fresh
environment, run them **in order** in the Supabase SQL editor (or
`supabase db push` if you link the CLI):

| File | Contents |
|---|---|
| `supabase/migrations/0001_schema.sql` | Enums, 13 tables, indexes, constraints, `updated_at` triggers, new-user profile trigger |
| `supabase/migrations/0002_rls.sql` | RLS enabled on every table + the §9.5 policy matrix |
| `supabase/migrations/0003_rpc.sql` | The transactional RPCs from §9.6 and the hourly job |
| `supabase/migrations/0004_storage_and_realtime.sql` | `avatars` / `group-images` buckets, storage policies, realtime publication |
| `supabase/migrations/0005_function_grants_hardening.sql` | Revokes the PUBLIC `EXECUTE` default so `anon` cannot reach the RPCs |
| `supabase/migrations/0006_fix_vote_ambiguity.sql` | Fixes a 42702 name collision that made every vote fail |
| `supabase/migrations/0007_lock_down_client_writes.sql` | Revokes client table DML; all writes go through RPCs |
| `supabase/migrations/0008_daily_reminder_window.sql` | Adapts the reminder window to a daily cron |

`0005` matters: Postgres grants `EXECUTE` on new functions to `PUBLIC`, which
left every security-definer function reachable by `anon` over
`/rest/v1/rpc/`. Without it, `active_member_count(gid)` handed a private group's
member count to anyone holding a UUID, contradicting BR-005.

### 1.3 Auth settings

In **Authentication → URL Configuration** add the callback:

```
http://localhost:3000/auth/callback
```

…and the same path on your deployed origin. Email confirmation must stay **on**
(AUTH-002).

### 1.4 Run

```bash
npm install
npm run dev
```

---

## 2. Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint (Next core-web-vitals + TypeScript) |
| `npm test` | Vitest — the overlap engine's 15 spec-derived cases |

The database layer was additionally verified end-to-end against the live project
with simulated `authenticated` sessions (`set_config('request.jwt.claims', …)`),
covering: username lowercasing, invite-hash-only storage, idempotent redemption,
unique member colours, adjacent-interval merging, non-member RLS isolation, vote
idempotency, admin-only closure, leader-only confirmation, one-plan-per-round,
pending-by-default attendance, no self-notification, and the owner-must-transfer
rule. All test rows were removed afterwards.

---

## 3. Layout

```
app/
  page.tsx                    landing + auth entry
  auth/                       sign-up, sign-in, forgot/reset password, callback
  join/[token]/, join/        group invite (§4.3 — generic before authorization)
  invite/[username]/          friend invite (§4.4)
  onboarding/                 Welcome → Profile → Friends → Group → Availability
  home/                       attention-first dashboard (§5.4)
  groups/                     list, create, detail, availability, plans, events, settings
  calendar/                   personal aggregated calendar (§5.6)
  notifications/  friends/  profile/  settings/
  api/cron/                   hourly scheduled job (§9.9)
components/
  ui/                         design system ported from the prototype
  app-shell.tsx               sidebar + feed + rail, bottom nav on mobile
  availability-editor.tsx     quick blocks + custom times (AVL-003)
lib/
  domain/                     types, Zod schemas, error contract, formatting, overlap engine
  actions/                    server actions — one per §9.6 operation
  data/queries.ts             authorized reads for the screens
  supabase/                   browser, server, and service-role clients
supabase/migrations/          schema, RLS, RPCs, storage
proxy.ts                      session refresh + AUTH-004/AUTH-005 routing
```

---

## 4. How the requirements land in code

| Area | Where |
|---|---|
| Overlap sweep (§9.7) | `lib/domain/overlap.ts` — pure, unit-tested, derived on read (OVL-001) |
| Error contract (§9.6) | `lib/domain/errors.ts` — stable codes in, Arabic copy out; raw DB text never surfaces |
| Arabic time (§8.6) | `lib/domain/format.ts` — Arabic-Indic digits, ص/م, Riyadh offset, midnight-crossing ranges |
| Authorization (BR-005/BR-006) | RLS policies + security-definer RPCs; the client never decides access |
| Invite secrecy (INV-001/INV-004) | Only the SHA-256 hash is stored; the raw token exists once, and the pre-auth page is generic |
| Invite intent (§4.3) | `lib/actions/invite-intent.ts` — httpOnly, same-site, 10-minute cookie; never a redirect parameter |
| Notification dedupe (NOT-005) | `(user_id, dedupe_key)` unique index; `push_notification` re-opens a read key rather than duplicating |
| Realtime (§9.8) | Subscribed only while a round is on screen; payloads trigger a re-fetch, never trusted directly |

---

## 5. Deploy

1. Push to GitHub and import the repo in Vercel.
2. Add the five environment variables from §1.1 (`NEXT_PUBLIC_SITE_URL` = the
   production origin).
3. `vercel.json` registers a **daily** cron hitting `/api/cron` at 06:00 UTC
   (09:00 Saudi time); Vercel sends `Authorization: Bearer $CRON_SECRET`
   automatically.

   Daily is a Hobby-plan limit — Vercel rejects any more frequent schedule.
   Migration `0008` widens the reminder window to 48 hours to match, so each
   attendee still gets exactly one reminder (enforced by the dedupe index), but
   1–2 days ahead rather than the exact 24 hours NOT-007 specifies. Restoring
   exact behaviour needs an hourly cron: either the Vercel Pro plan, or any
   external scheduler calling `/api/cron` hourly with the same bearer token,
   after reverting the window in `run_scheduled_jobs` to 23–25 hours.
4. Add the production `/auth/callback` URL in Supabase.

---

## 6. Not in MVP

Discovery, bookings, payments, chat, AI, calendar integrations, native apps,
push and email notifications (NOT-008), and any language other than Arabic.
Blocking is documented as a post-MVP safety requirement (§7.5).
