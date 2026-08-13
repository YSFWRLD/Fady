-- =============================================================================
-- فاضي؟ — 0001 schema
-- PRD §9.3 data model. All PKs are UUIDs generated server-side (BR-001) and all
-- timestamps are UTC (BR-002).
-- =============================================================================

-- Supabase ships pgcrypto in the `extensions` schema; digest()/gen_random_bytes()
-- are referenced schema-qualified below because every function pins an empty
-- search_path.
create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- Enums (§9.2)
-- ---------------------------------------------------------------------------
create type group_role            as enum ('owner', 'admin', 'member');
create type friendship_status     as enum ('pending', 'accepted', 'rejected', 'cancelled');
create type planning_round_status as enum ('open', 'confirmed', 'cancelled');
create type suggestion_status     as enum ('active', 'withdrawn');
create type confirmed_plan_status as enum ('scheduled', 'completed', 'cancelled');
create type attendance_status     as enum ('pending', 'going', 'not_going');
create type plan_category         as enum (
  'food', 'cinema', 'padel', 'football', 'coffee',
  'gaming', 'istiraha', 'outing', 'shopping', 'bowling', 'other'
);
create type notification_type     as enum (
  'friend_request', 'full_overlap', 'near_overlap', 'suggestion_created',
  'vote_activity', 'plan_confirmed', 'rsvp_required', 'plan_cancelled',
  'plan_reminder_24h'
);

-- ---------------------------------------------------------------------------
-- updated_at trigger
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create table public.profiles (
  id                      uuid primary key references auth.users(id) on delete cascade,
  -- PRO-002: stored lowercase and constrained to lowercase by the check below,
  -- so a plain unique index gives case-insensitive uniqueness without citext.
  username                text not null unique,
  display_name            text not null,
  avatar_path             text,
  onboarding_completed_at timestamptz,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  constraint profiles_username_format check (username ~ '^[a-z0-9_]{3,20}$'),
  constraint profiles_display_name_len check (char_length(btrim(display_name)) between 1 and 50)
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- FRN-001: prefix search by username.
create index profiles_username_prefix_idx on public.profiles (username text_pattern_ops);

-- ---------------------------------------------------------------------------
-- friendships
-- ---------------------------------------------------------------------------
create table public.friendships (
  id           uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(id) on delete cascade,
  receiver_id  uuid not null references public.profiles(id) on delete cascade,
  status       friendship_status not null default 'pending',
  responded_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  -- FRN-008: no self-requests.
  constraint friendships_not_self check (requester_id <> receiver_id)
);

create trigger friendships_set_updated_at
  before update on public.friendships
  for each row execute function public.set_updated_at();

-- FRN-002/FRN-008: one live relationship per unordered pair, in either
-- direction. Terminal rows stay for the FRN cooldown but do not block.
create unique index friendships_live_pair_idx
  on public.friendships (least(requester_id, receiver_id), greatest(requester_id, receiver_id))
  where status in ('pending', 'accepted');

create index friendships_receiver_idx  on public.friendships (receiver_id, status);
create index friendships_requester_idx on public.friendships (requester_id, status);

-- ---------------------------------------------------------------------------
-- groups
-- ---------------------------------------------------------------------------
create table public.groups (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  image_path text,
  created_by uuid not null references public.profiles(id),
  timezone   text not null default 'Asia/Riyadh',
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint groups_name_len  check (char_length(btrim(name)) between 1 and 40),
  -- BR-002: MVP is Riyadh-only.
  constraint groups_timezone_mvp check (timezone = 'Asia/Riyadh')
);

create trigger groups_set_updated_at
  before update on public.groups
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- group_members
-- ---------------------------------------------------------------------------
create table public.group_members (
  group_id       uuid not null references public.groups(id) on delete cascade,
  user_id        uuid not null references public.profiles(id) on delete cascade,
  role           group_role not null default 'member',
  -- GRP-010: index into the 30-token member palette; the UI always pairs it
  -- with a name and initial so colour is never the only cue.
  assigned_color smallint not null,
  joined_at      timestamptz not null default now(),
  left_at        timestamptz,
  primary key (group_id, user_id),
  constraint group_members_color_range check (assigned_color between 1 and 30)
);

-- GRP-002: exactly one active owner per group.
create unique index group_members_single_owner_idx
  on public.group_members (group_id)
  where role = 'owner' and left_at is null;

-- GRP-010: an active member's colour is unique inside the group.
create unique index group_members_active_color_idx
  on public.group_members (group_id, assigned_color)
  where left_at is null;

create index group_members_user_active_idx on public.group_members (user_id) where left_at is null;
create index group_members_group_active_idx on public.group_members (group_id) where left_at is null;

-- ---------------------------------------------------------------------------
-- group_invites
-- ---------------------------------------------------------------------------
create table public.group_invites (
  id         uuid primary key default gen_random_uuid(),
  group_id   uuid not null references public.groups(id) on delete cascade,
  -- INV-001: only the SHA-256 hash is stored; the raw token is returned once.
  token_hash text not null unique,
  created_by uuid not null references public.profiles(id),
  expires_at timestamptz not null default (now() + interval '30 days'),
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

-- INV-003: rotating revokes the previous link, so at most one stays active.
create unique index group_invites_one_active_idx
  on public.group_invites (group_id)
  where revoked_at is null;

-- ---------------------------------------------------------------------------
-- availability_slots
-- ---------------------------------------------------------------------------
create table public.availability_slots (
  id         uuid primary key default gen_random_uuid(),
  group_id   uuid not null references public.groups(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  start_at   timestamptz not null,
  end_at     timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint availability_order check (end_at > start_at)
);

create trigger availability_set_updated_at
  before update on public.availability_slots
  for each row execute function public.set_updated_at();

create index availability_group_range_idx on public.availability_slots (group_id, start_at, end_at);
create index availability_user_group_idx  on public.availability_slots (user_id, group_id, start_at);

-- ---------------------------------------------------------------------------
-- planning_rounds
-- ---------------------------------------------------------------------------
create table public.planning_rounds (
  id              uuid primary key default gen_random_uuid(),
  group_id        uuid not null references public.groups(id) on delete cascade,
  created_by      uuid not null references public.profiles(id),
  window_start_at timestamptz not null,
  window_end_at   timestamptz not null,
  status          planning_round_status not null default 'open',
  closed_by       uuid references public.profiles(id),
  closed_at       timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint planning_rounds_window check (window_end_at > window_start_at)
);

create trigger planning_rounds_set_updated_at
  before update on public.planning_rounds
  for each row execute function public.set_updated_at();

create index planning_rounds_group_status_idx on public.planning_rounds (group_id, status, window_start_at);

-- ---------------------------------------------------------------------------
-- plan_suggestions
-- ---------------------------------------------------------------------------
create table public.plan_suggestions (
  id                uuid primary key default gen_random_uuid(),
  round_id          uuid not null references public.planning_rounds(id) on delete cascade,
  suggested_by      uuid not null references public.profiles(id),
  category          plan_category not null,
  title             text not null,
  description       text,
  proposed_start_at timestamptz not null,
  proposed_end_at   timestamptz not null,
  location          text,
  external_url      text,
  status            suggestion_status not null default 'active',
  withdrawn_at      timestamptz,
  created_at        timestamptz not null default now(),
  constraint suggestion_title_len   check (char_length(btrim(title)) between 1 and 80),
  constraint suggestion_desc_len    check (description is null or char_length(description) <= 500),
  constraint suggestion_location_len check (location is null or char_length(location) <= 120),
  constraint suggestion_time_order  check (proposed_end_at > proposed_start_at),
  -- PLN-009: https only, never fetched server-side.
  constraint suggestion_url_https   check (
    external_url is null or (external_url ~ '^https://' and char_length(external_url) <= 2048)
  )
);

create index plan_suggestions_round_idx on public.plan_suggestions (round_id, status);

-- ---------------------------------------------------------------------------
-- suggestion_votes
-- ---------------------------------------------------------------------------
create table public.suggestion_votes (
  suggestion_id uuid not null references public.plan_suggestions(id) on delete cascade,
  user_id       uuid not null references public.profiles(id) on delete cascade,
  created_at    timestamptz not null default now(),
  -- VOT-002/VOT-004: at most one active vote per member per suggestion.
  primary key (suggestion_id, user_id)
);

create index suggestion_votes_user_idx on public.suggestion_votes (user_id);

-- ---------------------------------------------------------------------------
-- confirmed_plans
-- ---------------------------------------------------------------------------
create table public.confirmed_plans (
  id                    uuid primary key default gen_random_uuid(),
  group_id              uuid not null references public.groups(id) on delete cascade,
  -- CNF-001: one confirmed plan per round, enforced by the DB.
  round_id              uuid not null unique references public.planning_rounds(id) on delete cascade,
  winning_suggestion_id uuid not null unique references public.plan_suggestions(id),
  confirmed_by          uuid not null references public.profiles(id),
  -- CNF-002: snapshot of the winning suggestion at confirmation time.
  category              plan_category not null,
  title                 text not null,
  description           text,
  start_at              timestamptz not null,
  end_at                timestamptz not null,
  location              text,
  external_url          text,
  status                confirmed_plan_status not null default 'scheduled',
  cancellation_reason   text,
  cancelled_at          timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint plan_time_order   check (end_at > start_at),
  constraint plan_reason_len   check (cancellation_reason is null or char_length(cancellation_reason) <= 250)
);

create trigger confirmed_plans_set_updated_at
  before update on public.confirmed_plans
  for each row execute function public.set_updated_at();

create index confirmed_plans_group_idx  on public.confirmed_plans (group_id, status, start_at);
create index confirmed_plans_status_idx on public.confirmed_plans (status, end_at);

-- ---------------------------------------------------------------------------
-- plan_attendees
-- ---------------------------------------------------------------------------
create table public.plan_attendees (
  confirmed_plan_id uuid not null references public.confirmed_plans(id) on delete cascade,
  user_id           uuid not null references public.profiles(id) on delete cascade,
  status            attendance_status not null default 'pending',
  responded_at      timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  primary key (confirmed_plan_id, user_id)
);

create trigger plan_attendees_set_updated_at
  before update on public.plan_attendees
  for each row execute function public.set_updated_at();

create index plan_attendees_user_idx on public.plan_attendees (user_id, status);

-- ---------------------------------------------------------------------------
-- notifications
-- ---------------------------------------------------------------------------
create table public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  type       notification_type not null,
  actor_id   uuid references public.profiles(id) on delete set null,
  group_id   uuid references public.groups(id) on delete cascade,
  entity_id  uuid,
  -- NOT-005: minimal rendering values only; no duplicated private free text.
  payload    jsonb not null default '{}'::jsonb,
  dedupe_key text not null,
  read_at    timestamptz,
  created_at timestamptz not null default now()
);

create unique index notifications_dedupe_idx on public.notifications (user_id, dedupe_key);
create index notifications_inbox_idx on public.notifications (user_id, created_at desc);
create index notifications_unread_idx on public.notifications (user_id) where read_at is null;

-- ---------------------------------------------------------------------------
-- friend_request_attempts — FRN acceptance criterion: a rejected request is
-- rate-limited for 24 hours before it can be sent again.
-- ---------------------------------------------------------------------------
create table public.friend_request_attempts (
  requester_id uuid not null references public.profiles(id) on delete cascade,
  receiver_id  uuid not null references public.profiles(id) on delete cascade,
  rejected_at  timestamptz not null default now(),
  primary key (requester_id, receiver_id)
);

-- ---------------------------------------------------------------------------
-- New auth user -> placeholder profile. The real display name and username are
-- collected in onboarding (PRO-001); until then onboarding_completed_at is null
-- and AUTH-005 keeps the user out of private routes.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  candidate text;
  suffix    int := 0;
begin
  candidate := 'user_' || substr(replace(new.id::text, '-', ''), 1, 12);
  while exists (select 1 from public.profiles p where p.username = candidate) loop
    suffix := suffix + 1;
    candidate := 'user_' || substr(replace(new.id::text, '-', ''), 1, 10) || suffix::text;
  end loop;

  insert into public.profiles (id, username, display_name)
  values (new.id, candidate, 'عضو جديد')
  on conflict (id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
