-- =============================================================================
-- فاضي؟ — 0002 row level security
-- PRD §9.5. RLS is enabled on every application table. BR-006: client-side
-- visibility is never authorization. Every helper is security definer with a
-- pinned empty search_path and validates auth.uid() itself.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Membership helpers. These are security definer so policies on group_members
-- can ask "is the caller a member?" without recursing into their own policy.
-- ---------------------------------------------------------------------------
create or replace function public.is_active_member(gid uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.group_members gm
    join public.groups g on g.id = gm.group_id
    where gm.group_id = gid
      and gm.user_id = (select auth.uid())
      and gm.left_at is null
      and g.deleted_at is null
  );
$$;

create or replace function public.is_group_admin(gid uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.group_members gm
    join public.groups g on g.id = gm.group_id
    where gm.group_id = gid
      and gm.user_id = (select auth.uid())
      and gm.left_at is null
      and gm.role in ('owner', 'admin')
      and g.deleted_at is null
  );
$$;

create or replace function public.is_group_owner(gid uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.group_members gm
    join public.groups g on g.id = gm.group_id
    where gm.group_id = gid
      and gm.user_id = (select auth.uid())
      and gm.left_at is null
      and gm.role = 'owner'
      and g.deleted_at is null
  );
$$;

create or replace function public.active_member_count(gid uuid)
returns integer
language sql
security definer
stable
set search_path = ''
as $$
  select count(*)::int
  from public.group_members gm
  where gm.group_id = gid and gm.left_at is null;
$$;

/** The round's group, used by suggestion and vote policies. */
create or replace function public.round_group_id(rid uuid)
returns uuid
language sql
security definer
stable
set search_path = ''
as $$
  select pr.group_id from public.planning_rounds pr where pr.id = rid;
$$;

create or replace function public.suggestion_group_id(sid uuid)
returns uuid
language sql
security definer
stable
set search_path = ''
as $$
  select pr.group_id
  from public.plan_suggestions ps
  join public.planning_rounds pr on pr.id = ps.round_id
  where ps.id = sid;
$$;

create or replace function public.plan_group_id(pid uuid)
returns uuid
language sql
security definer
stable
set search_path = ''
as $$
  select cp.group_id from public.confirmed_plans cp where cp.id = pid;
$$;

-- ---------------------------------------------------------------------------
alter table public.profiles                enable row level security;
alter table public.friendships             enable row level security;
alter table public.groups                  enable row level security;
alter table public.group_members           enable row level security;
alter table public.group_invites           enable row level security;
alter table public.availability_slots      enable row level security;
alter table public.planning_rounds         enable row level security;
alter table public.plan_suggestions        enable row level security;
alter table public.suggestion_votes        enable row level security;
alter table public.confirmed_plans         enable row level security;
alter table public.plan_attendees          enable row level security;
alter table public.notifications           enable row level security;
alter table public.friend_request_attempts enable row level security;

-- ---------------------------------------------------------------------------
-- profiles — the table holds only the minimal fields FRN-001 search, friends,
-- and member lists need (no email, no private content), so authenticated read
-- is the approved projection. Writes are restricted to the owner.
-- ---------------------------------------------------------------------------
create policy profiles_select_authenticated on public.profiles
  for select to authenticated using (true);

create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- friendships — requester or receiver only.
-- ---------------------------------------------------------------------------
create policy friendships_select_participants on public.friendships
  for select to authenticated
  using (requester_id = (select auth.uid()) or receiver_id = (select auth.uid()));

-- Inserts, accepts, and removals all go through RPCs (§9.6) which enforce the
-- pair uniqueness, cooldown, and notification rules.

-- ---------------------------------------------------------------------------
-- groups — active members only; BR-005 authorization comes from membership,
-- never from knowing the UUID. A soft-deleted group disappears (GRP-009).
-- ---------------------------------------------------------------------------
create policy groups_select_members on public.groups
  for select to authenticated
  using (deleted_at is null and public.is_active_member(id));

create policy groups_update_admin on public.groups
  for update to authenticated
  using (deleted_at is null and public.is_group_admin(id))
  with check (deleted_at is null and public.is_group_admin(id));

-- ---------------------------------------------------------------------------
-- group_members — visible to active members of the same group.
-- ---------------------------------------------------------------------------
create policy group_members_select_same_group on public.group_members
  for select to authenticated
  using (public.is_active_member(group_id));

-- ---------------------------------------------------------------------------
-- group_invites — INV-004: the token row is never readable before redemption;
-- only owners/admins of the group can see invite metadata.
-- ---------------------------------------------------------------------------
create policy group_invites_select_admin on public.group_invites
  for select to authenticated
  using (public.is_group_admin(group_id));

-- ---------------------------------------------------------------------------
-- availability_slots — AVL-001: group-scoped, active members only. Writes go
-- through replace_availability (AVL-002 keeps them to the caller's own rows).
-- ---------------------------------------------------------------------------
create policy availability_select_members on public.availability_slots
  for select to authenticated
  using (public.is_active_member(group_id));

-- ---------------------------------------------------------------------------
-- planning_rounds
-- ---------------------------------------------------------------------------
create policy planning_rounds_select_members on public.planning_rounds
  for select to authenticated
  using (public.is_active_member(group_id));

-- ---------------------------------------------------------------------------
-- plan_suggestions — PLN-005: members add while the round is open; PLN-008: the
-- creator withdraws while open. Everything else is read-only through RLS.
-- ---------------------------------------------------------------------------
create policy plan_suggestions_select_members on public.plan_suggestions
  for select to authenticated
  using (public.is_active_member(public.round_group_id(round_id)));

create policy plan_suggestions_insert_members on public.plan_suggestions
  for insert to authenticated
  with check (
    suggested_by = (select auth.uid())
    and public.is_active_member(public.round_group_id(round_id))
    and exists (
      select 1 from public.planning_rounds pr
      where pr.id = round_id and pr.status = 'open'
    )
  );

create policy plan_suggestions_withdraw_own on public.plan_suggestions
  for update to authenticated
  using (
    suggested_by = (select auth.uid())
    and exists (select 1 from public.planning_rounds pr where pr.id = round_id and pr.status = 'open')
  )
  with check (suggested_by = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- suggestion_votes — VOT-001/VOT-003: a member controls their own vote while
-- the round is open and the suggestion is active. Totals are visible to all
-- members of the group (VOT-005).
-- ---------------------------------------------------------------------------
create policy suggestion_votes_select_members on public.suggestion_votes
  for select to authenticated
  using (public.is_active_member(public.suggestion_group_id(suggestion_id)));

create policy suggestion_votes_insert_own on public.suggestion_votes
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and public.is_active_member(public.suggestion_group_id(suggestion_id))
    and exists (
      select 1
      from public.plan_suggestions ps
      join public.planning_rounds pr on pr.id = ps.round_id
      where ps.id = suggestion_id and ps.status = 'active' and pr.status = 'open'
    )
  );

create policy suggestion_votes_delete_own on public.suggestion_votes
  for delete to authenticated
  using (
    user_id = (select auth.uid())
    and exists (
      select 1
      from public.plan_suggestions ps
      join public.planning_rounds pr on pr.id = ps.round_id
      where ps.id = suggestion_id and pr.status = 'open'
    )
  );

-- ---------------------------------------------------------------------------
-- confirmed_plans — created and cancelled only through admin RPCs (CNF-001).
-- ---------------------------------------------------------------------------
create policy confirmed_plans_select_members on public.confirmed_plans
  for select to authenticated
  using (public.is_active_member(group_id));

-- ---------------------------------------------------------------------------
-- plan_attendees — CNF-004: a member changes only their own response.
-- ---------------------------------------------------------------------------
create policy plan_attendees_select_members on public.plan_attendees
  for select to authenticated
  using (public.is_active_member(public.plan_group_id(confirmed_plan_id)));

create policy plan_attendees_update_own on public.plan_attendees
  for update to authenticated
  using (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.confirmed_plans cp
      where cp.id = confirmed_plan_id and cp.status = 'scheduled'
    )
  )
  with check (user_id = (select auth.uid()));

-- CNF-009: a member who joined after confirmation adds their own pending row.
create policy plan_attendees_insert_own on public.plan_attendees
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and public.is_active_member(public.plan_group_id(confirmed_plan_id))
  );

-- ---------------------------------------------------------------------------
-- notifications — recipient only; NOT-003 lets them update read_at and nothing
-- else. Inserts come from security-definer functions and the service role.
-- ---------------------------------------------------------------------------
create policy notifications_select_own on public.notifications
  for select to authenticated using (user_id = (select auth.uid()));

create policy notifications_update_own on public.notifications
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- friend_request_attempts — internal cooldown bookkeeping, no client access.
-- (RLS enabled with no policy = deny all for anon/authenticated.)
-- ---------------------------------------------------------------------------
