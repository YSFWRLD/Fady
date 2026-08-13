-- =============================================================================
-- فاضي؟ — 0003 transactional RPCs
-- PRD §9.6. Every function here is security definer with a pinned empty
-- search_path, validates auth.uid() itself, avoids dynamic SQL, and returns the
-- minimum required fields. BR-007: multi-record mutations are transactional and
-- idempotent. Errors are raised as the stable contract codes from §9.6.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Internal: caller identity, or UNAUTHENTICATED.
-- ---------------------------------------------------------------------------
create or replace function public.require_uid()
returns uuid
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
begin
  if uid is null then
    raise exception 'UNAUTHENTICATED';
  end if;
  return uid;
end;
$$;

-- ---------------------------------------------------------------------------
-- Internal: NOT-004 (never notify the actor) and NOT-005 (deterministic dedupe).
-- Re-firing a key that the recipient already read makes it unread again, which
-- is what NOT-006 wants for aggregated vote activity.
-- ---------------------------------------------------------------------------
create or replace function public.push_notification(
  p_user_id    uuid,
  p_type       public.notification_type,
  p_actor_id   uuid,
  p_group_id   uuid,
  p_entity_id  uuid,
  p_payload    jsonb,
  p_dedupe_key text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_user_id is null or p_user_id = p_actor_id then
    return;
  end if;

  insert into public.notifications (user_id, type, actor_id, group_id, entity_id, payload, dedupe_key)
  values (p_user_id, p_type, p_actor_id, p_group_id, p_entity_id, coalesce(p_payload, '{}'::jsonb), p_dedupe_key)
  on conflict (user_id, dedupe_key) do update
    set read_at    = null,
        created_at = now(),
        payload    = excluded.payload
    where public.notifications.read_at is not null;
end;
$$;

-- ---------------------------------------------------------------------------
-- Internal: GRP-010 colour allocation — lowest free token in the group.
-- ---------------------------------------------------------------------------
create or replace function public.next_member_color(gid uuid)
returns smallint
language sql
security definer
stable
set search_path = ''
as $$
  select min(c)::smallint
  from generate_series(1, 30) as c
  where not exists (
    select 1 from public.group_members gm
    where gm.group_id = gid and gm.left_at is null and gm.assigned_color = c
  );
$$;

-- ===========================================================================
-- Profile and friends
-- ===========================================================================

-- PRO-001/PRO-002: unique, case-insensitive username; marks onboarding done.
create or replace function public.complete_profile(
  p_display_name text,
  p_username     text,
  p_avatar_path  text default null
)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := public.require_uid();
  result public.profiles;
begin
  if btrim(p_display_name) = '' or char_length(btrim(p_display_name)) > 50 then
    raise exception 'VALIDATION_ERROR';
  end if;
  if lower(btrim(p_username)) !~ '^[a-z0-9_]{3,20}$' then
    raise exception 'VALIDATION_ERROR';
  end if;

  begin
    update public.profiles
      set display_name = btrim(p_display_name),
          username     = lower(btrim(p_username)),
          avatar_path  = coalesce(p_avatar_path, avatar_path),
          onboarding_completed_at = coalesce(onboarding_completed_at, now())
      where id = uid
      returning * into result;
  exception when unique_violation then
    -- Surfaces as "اسم المستخدم مستخدم".
    raise exception 'CONFLICT';
  end;

  if result.id is null then
    raise exception 'NOT_FOUND';
  end if;
  return result;
end;
$$;

-- FRN-001: prefix search, rate-limited by the caller and paginated at 20.
create or replace function public.search_users(p_query text, p_limit int default 20)
returns table (id uuid, username text, display_name text, avatar_path text)
language sql
security definer
stable
set search_path = ''
as $$
  select p.id, p.username, p.display_name, p.avatar_path
  from public.profiles p
  where (select auth.uid()) is not null
    and p.id <> (select auth.uid())
    and p.onboarding_completed_at is not null
    and p.username like lower(btrim(p_query)) || '%'
  order by p.username
  limit least(coalesce(p_limit, 20), 20);
$$;

-- FRN-002/FRN-008 plus the 24-hour cooldown after a rejection.
create or replace function public.send_friend_request(p_target uuid)
returns public.friendships
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid      uuid := public.require_uid();
  existing public.friendships;
  result   public.friendships;
begin
  if p_target = uid then
    raise exception 'VALIDATION_ERROR';
  end if;
  if not exists (select 1 from public.profiles where id = p_target) then
    raise exception 'NOT_FOUND';
  end if;

  select * into existing
  from public.friendships f
  where f.status in ('pending', 'accepted')
    and least(f.requester_id, f.receiver_id) = least(uid, p_target)
    and greatest(f.requester_id, f.receiver_id) = greatest(uid, p_target);

  -- Idempotent: an existing live relationship is returned untouched.
  if existing.id is not null then
    return existing;
  end if;

  if exists (
    select 1 from public.friend_request_attempts a
    where a.requester_id = uid and a.receiver_id = p_target
      and a.rejected_at > now() - interval '24 hours'
  ) then
    raise exception 'RATE_LIMITED';
  end if;

  insert into public.friendships (requester_id, receiver_id, status)
  values (uid, p_target, 'pending')
  returning * into result;

  perform public.push_notification(
    p_target, 'friend_request', uid, null, result.id, '{}'::jsonb, 'friend_request:' || result.id::text
  );
  return result;
end;
$$;

-- FRN-003/FRN-004: only the receiver may accept or reject.
create or replace function public.respond_friend_request(p_friendship uuid, p_accept boolean)
returns public.friendships
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid    uuid := public.require_uid();
  result public.friendships;
begin
  update public.friendships
    set status = case when p_accept then 'accepted'::public.friendship_status else 'rejected'::public.friendship_status end,
        responded_at = now()
    where id = p_friendship and receiver_id = uid and status = 'pending'
    returning * into result;

  if result.id is null then
    raise exception 'NOT_FOUND';
  end if;

  if not p_accept then
    insert into public.friend_request_attempts (requester_id, receiver_id, rejected_at)
    values (result.requester_id, result.receiver_id, now())
    on conflict (requester_id, receiver_id) do update set rejected_at = now();
  end if;

  return result;
end;
$$;

-- FRN-005/FRN-006: either participant removes it; group access is unaffected.
create or replace function public.remove_friend(p_friendship uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := public.require_uid();
  n   int;
begin
  delete from public.friendships
  where id = p_friendship
    and status in ('pending', 'accepted')
    and (requester_id = uid or receiver_id = uid);
  get diagnostics n = row_count;
  if n = 0 then
    raise exception 'NOT_FOUND';
  end if;
end;
$$;

-- ===========================================================================
-- Groups and invites
-- ===========================================================================

-- GRP-001: group, owner membership, colour, and the first invite in one
-- transaction. Returns the raw invite token exactly once (INV-001).
create or replace function public.create_group(p_name text, p_image_path text default null)
returns table (group_id uuid, invite_token text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid      uuid := public.require_uid();
  new_gid  uuid;
  raw_token text;
begin
  if btrim(coalesce(p_name, '')) = '' or char_length(btrim(p_name)) > 40 then
    raise exception 'VALIDATION_ERROR';
  end if;
  if not exists (select 1 from public.profiles where id = uid and onboarding_completed_at is not null) then
    raise exception 'FORBIDDEN';
  end if;

  insert into public.groups (name, image_path, created_by)
  values (btrim(p_name), p_image_path, uid)
  returning id into new_gid;

  insert into public.group_members (group_id, user_id, role, assigned_color)
  values (new_gid, uid, 'owner', 1);

  raw_token := encode(extensions.gen_random_bytes(16), 'hex');
  insert into public.group_invites (group_id, token_hash, created_by)
  values (new_gid, encode(extensions.digest(raw_token, 'sha256'), 'hex'), uid);

  group_id := new_gid;
  invite_token := raw_token;
  return next;
end;
$$;

-- INV-003: rotating revokes the previous active link atomically.
create or replace function public.rotate_group_invite(p_group uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid       uuid := public.require_uid();
  raw_token text;
begin
  if not public.is_group_admin(p_group) then
    raise exception 'FORBIDDEN';
  end if;

  update public.group_invites
    set revoked_at = now()
    where group_id = p_group and revoked_at is null;

  raw_token := encode(extensions.gen_random_bytes(16), 'hex');
  insert into public.group_invites (group_id, token_hash, created_by)
  values (p_group, encode(extensions.digest(raw_token, 'sha256'), 'hex'), uid);

  return raw_token;
end;
$$;

-- INV-005/INV-006/GRP-003: one atomic check of auth, expiry, revocation, group
-- state, capacity, and existing membership, under a row lock on the group.
create or replace function public.redeem_group_invite(p_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid       uuid := public.require_uid();
  inv       public.group_invites;
  gid       uuid;
  existing  public.group_members;
  colour    smallint;
begin
  if not exists (select 1 from public.profiles where id = uid and onboarding_completed_at is not null) then
    raise exception 'FORBIDDEN';
  end if;

  select * into inv
  from public.group_invites gi
  where gi.token_hash = encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex');

  -- INV-004: an unknown token reveals nothing about any group.
  if inv.id is null then
    raise exception 'NOT_FOUND';
  end if;
  if inv.revoked_at is not null then
    raise exception 'INVITE_REVOKED';
  end if;
  if inv.expires_at <= now() then
    raise exception 'INVITE_EXPIRED';
  end if;

  -- Serialize concurrent redemptions of the final seat.
  select g.id into gid from public.groups g
    where g.id = inv.group_id and g.deleted_at is null
    for update;
  if gid is null then
    raise exception 'NOT_FOUND';
  end if;

  select * into existing from public.group_members gm
    where gm.group_id = gid and gm.user_id = uid;

  -- INV-006: redeeming twice routes the existing member to the group.
  if existing.user_id is not null and existing.left_at is null then
    return gid;
  end if;

  if (select count(*) from public.group_members gm where gm.group_id = gid and gm.left_at is null) >= 30 then
    raise exception 'GROUP_FULL';
  end if;

  colour := public.next_member_color(gid);
  if colour is null then
    raise exception 'GROUP_FULL';
  end if;

  if existing.user_id is not null then
    -- Rejoining after leaving: reactivate rather than duplicate.
    update public.group_members
      set left_at = null, role = 'member', assigned_color = colour, joined_at = now()
      where group_id = gid and user_id = uid;
  else
    insert into public.group_members (group_id, user_id, role, assigned_color)
    values (gid, uid, 'member', colour);
  end if;

  return gid;
end;
$$;

-- GRP-005: owner-only role changes, protecting the sole owner.
create or replace function public.change_member_role(p_group uuid, p_user uuid, p_role public.group_role)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := public.require_uid();
begin
  if not public.is_group_owner(p_group) then
    raise exception 'FORBIDDEN';
  end if;
  if p_user = uid then
    raise exception 'VALIDATION_ERROR';
  end if;
  if not exists (
    select 1 from public.group_members where group_id = p_group and user_id = p_user and left_at is null
  ) then
    raise exception 'NOT_FOUND';
  end if;

  if p_role = 'owner' then
    -- GRP-005 transfer: demote the current owner in the same transaction so the
    -- single-active-owner index always holds.
    update public.group_members set role = 'member'
      where group_id = p_group and user_id = uid and left_at is null;
    update public.group_members set role = 'owner'
      where group_id = p_group and user_id = p_user and left_at is null;
  else
    update public.group_members set role = p_role
      where group_id = p_group and user_id = p_user and left_at is null;
  end if;
end;
$$;

-- GRP-004/§7.2: an admin may not remove the owner or another admin.
create or replace function public.remove_group_member(p_group uuid, p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid         uuid := public.require_uid();
  target_role public.group_role;
begin
  if not public.is_group_admin(p_group) then
    raise exception 'FORBIDDEN';
  end if;
  if p_user = uid then
    raise exception 'VALIDATION_ERROR';
  end if;

  select role into target_role from public.group_members
    where group_id = p_group and user_id = p_user and left_at is null;
  if target_role is null then
    raise exception 'NOT_FOUND';
  end if;
  if target_role in ('owner', 'admin') and not public.is_group_owner(p_group) then
    raise exception 'FORBIDDEN';
  end if;
  if target_role = 'owner' then
    raise exception 'FORBIDDEN';
  end if;

  -- GRP-008: access ends now; historical attribution is preserved.
  update public.group_members set left_at = now()
    where group_id = p_group and user_id = p_user;
  delete from public.availability_slots where group_id = p_group and user_id = p_user;
end;
$$;

-- GRP-007: an owner with other members must transfer ownership first.
create or replace function public.leave_group(p_group uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid       uuid := public.require_uid();
  my_role   public.group_role;
  others    int;
begin
  select role into my_role from public.group_members
    where group_id = p_group and user_id = uid and left_at is null;
  if my_role is null then
    raise exception 'NOT_FOUND';
  end if;

  select count(*) into others from public.group_members
    where group_id = p_group and left_at is null and user_id <> uid;

  if my_role = 'owner' and others > 0 then
    raise exception 'FORBIDDEN';
  end if;

  update public.group_members set left_at = now()
    where group_id = p_group and user_id = uid;
  delete from public.availability_slots where group_id = p_group and user_id = uid;

  -- The last member leaving retires the group rather than orphaning it.
  if others = 0 then
    update public.groups set deleted_at = now() where id = p_group and deleted_at is null;
  end if;
end;
$$;

-- GRP-009: soft-delete, revoke invites, cancel scheduled plans, notify.
create or replace function public.delete_group(p_group uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := public.require_uid();
  m   record;
begin
  if not public.is_group_owner(p_group) then
    raise exception 'FORBIDDEN';
  end if;

  update public.groups set deleted_at = now() where id = p_group and deleted_at is null;
  update public.group_invites set revoked_at = now() where group_id = p_group and revoked_at is null;
  update public.planning_rounds set status = 'cancelled', closed_by = uid, closed_at = now()
    where group_id = p_group and status = 'open';

  for m in
    select cp.id from public.confirmed_plans cp
    where cp.group_id = p_group and cp.status = 'scheduled'
  loop
    update public.confirmed_plans
      set status = 'cancelled', cancelled_at = now(), cancellation_reason = 'القروب انحذف'
      where id = m.id;
  end loop;

  for m in
    select gm.user_id from public.group_members gm where gm.group_id = p_group and gm.left_at is null
  loop
    perform public.push_notification(
      m.user_id, 'plan_cancelled', uid, p_group, p_group, '{}'::jsonb,
      'group_deleted:' || p_group::text
    );
  end loop;
end;
$$;

-- ===========================================================================
-- Availability
-- ===========================================================================

-- AVL-002/AVL-004/AVL-007: replaces the caller's own future intervals in the
-- requested range, validating the 28-day horizon and merging on save.
create or replace function public.replace_availability(
  p_group       uuid,
  p_intervals   jsonb,
  p_range_start timestamptz,
  p_range_end   timestamptz
)
returns setof public.availability_slots
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid      uuid := public.require_uid();
  horizon  timestamptz := now() + interval '29 days';
  iv       record;
  cur_start timestamptz;
  cur_end   timestamptz;
begin
  if not public.is_active_member(p_group) then
    raise exception 'FORBIDDEN';
  end if;
  if p_range_end <= p_range_start or p_range_end > horizon then
    raise exception 'VALIDATION_ERROR';
  end if;

  -- AVL-008: only future intervals are replaced; the past stays read-only.
  delete from public.availability_slots a
  where a.group_id = p_group
    and a.user_id  = uid
    and a.end_at   > greatest(p_range_start, now())
    and a.start_at < p_range_end;

  cur_start := null;
  cur_end   := null;

  for iv in
    select (value ->> 'startAt')::timestamptz as s,
           (value ->> 'endAt')::timestamptz   as e
    from jsonb_array_elements(coalesce(p_intervals, '[]'::jsonb))
    order by (value ->> 'startAt')::timestamptz
  loop
    if iv.e <= iv.s then
      raise exception 'VALIDATION_ERROR';
    end if;
    if iv.s < p_range_start or iv.e > p_range_end or iv.e > horizon then
      raise exception 'VALIDATION_ERROR';
    end if;
    -- Anything already finished is dropped rather than persisted.
    if iv.e <= now() then
      continue;
    end if;

    if cur_start is null then
      cur_start := iv.s; cur_end := iv.e;
    elsif iv.s <= cur_end then
      -- AVL-007: overlapping or adjacent intervals merge into one row.
      cur_end := greatest(cur_end, iv.e);
    else
      insert into public.availability_slots (group_id, user_id, start_at, end_at)
      values (p_group, uid, cur_start, cur_end);
      cur_start := iv.s; cur_end := iv.e;
    end if;
  end loop;

  if cur_start is not null then
    insert into public.availability_slots (group_id, user_id, start_at, end_at)
    values (p_group, uid, cur_start, cur_end);
  end if;

  return query
    select * from public.availability_slots a
    where a.group_id = p_group and a.user_id = uid
    order by a.start_at;
end;
$$;

-- ===========================================================================
-- Planning rounds, suggestions, voting
-- ===========================================================================

-- PLN-001/PLN-004: a round becomes open together with its first suggestion.
create or replace function public.open_planning_round(
  p_group        uuid,
  p_window_start timestamptz,
  p_window_end   timestamptz,
  p_category     public.plan_category,
  p_title        text,
  p_description  text,
  p_start_at     timestamptz,
  p_end_at       timestamptz,
  p_location     text,
  p_external_url text
)
returns table (round_id uuid, suggestion_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid   uuid := public.require_uid();
  r_id  uuid;
  s_id  uuid;
  m     record;
begin
  if not public.is_active_member(p_group) then
    raise exception 'FORBIDDEN';
  end if;
  if p_window_end <= p_window_start
     or p_window_start < now()
     or p_window_end > now() + interval '29 days' then
    raise exception 'VALIDATION_ERROR';
  end if;
  -- PLN-003: suggestion times must sit inside the round window.
  if p_start_at < p_window_start or p_end_at > p_window_end or p_end_at <= p_start_at then
    raise exception 'VALIDATION_ERROR';
  end if;

  insert into public.planning_rounds (group_id, created_by, window_start_at, window_end_at, status)
  values (p_group, uid, p_window_start, p_window_end, 'open')
  returning id into r_id;

  insert into public.plan_suggestions (
    round_id, suggested_by, category, title, description,
    proposed_start_at, proposed_end_at, location, external_url
  )
  values (
    r_id, uid, p_category, btrim(p_title), nullif(btrim(coalesce(p_description, '')), ''),
    p_start_at, p_end_at, nullif(btrim(coalesce(p_location, '')), ''), nullif(btrim(coalesce(p_external_url, '')), '')
  )
  returning id into s_id;

  -- NOT-006: other members hear about the suggestion once.
  for m in select gm.user_id from public.group_members gm
           where gm.group_id = p_group and gm.left_at is null
  loop
    perform public.push_notification(
      m.user_id, 'suggestion_created', uid, p_group, r_id,
      jsonb_build_object('category', p_category), 'suggestion:' || s_id::text
    );
  end loop;

  round_id := r_id;
  suggestion_id := s_id;
  return next;
end;
$$;

-- PLN-005/PLN-006: any active member adds a suggestion while the round is open.
create or replace function public.add_suggestion(
  p_round        uuid,
  p_category     public.plan_category,
  p_title        text,
  p_description  text,
  p_start_at     timestamptz,
  p_end_at       timestamptz,
  p_location     text,
  p_external_url text
)
returns public.plan_suggestions
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid    uuid := public.require_uid();
  rnd    public.planning_rounds;
  result public.plan_suggestions;
  m      record;
begin
  select * into rnd from public.planning_rounds where id = p_round;
  if rnd.id is null or not public.is_active_member(rnd.group_id) then
    raise exception 'NOT_FOUND';
  end if;
  if rnd.status <> 'open' then
    raise exception 'ROUND_CLOSED';
  end if;
  if p_start_at < rnd.window_start_at or p_end_at > rnd.window_end_at or p_end_at <= p_start_at then
    raise exception 'VALIDATION_ERROR';
  end if;

  insert into public.plan_suggestions (
    round_id, suggested_by, category, title, description,
    proposed_start_at, proposed_end_at, location, external_url
  )
  values (
    p_round, uid, p_category, btrim(p_title), nullif(btrim(coalesce(p_description, '')), ''),
    p_start_at, p_end_at, nullif(btrim(coalesce(p_location, '')), ''), nullif(btrim(coalesce(p_external_url, '')), '')
  )
  returning * into result;

  for m in select gm.user_id from public.group_members gm
           where gm.group_id = rnd.group_id and gm.left_at is null
  loop
    perform public.push_notification(
      m.user_id, 'suggestion_created', uid, rnd.group_id, p_round,
      jsonb_build_object('category', p_category), 'suggestion:' || result.id::text
    );
  end loop;

  return result;
end;
$$;

-- PLN-008: the creator withdraws while open; votes leave the active tally but
-- the rows stay for audit.
create or replace function public.withdraw_suggestion(p_suggestion uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := public.require_uid();
  n   int;
begin
  update public.plan_suggestions ps
    set status = 'withdrawn', withdrawn_at = now()
    where ps.id = p_suggestion
      and ps.suggested_by = uid
      and ps.status = 'active'
      and exists (select 1 from public.planning_rounds pr where pr.id = ps.round_id and pr.status = 'open');
  get diagnostics n = row_count;
  if n = 0 then
    raise exception 'ROUND_CLOSED';
  end if;
end;
$$;

-- VOT-001..VOT-005: idempotent approval vote, returning the authoritative tally.
create or replace function public.set_suggestion_vote(p_suggestion uuid, p_selected boolean)
returns table (suggestion_id uuid, votes int, selected boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := public.require_uid();
  gid uuid;
  rid uuid;
  st  public.suggestion_status;
  rst public.planning_round_status;
  m   record;
begin
  select pr.group_id, pr.id, ps.status, pr.status
    into gid, rid, st, rst
  from public.plan_suggestions ps
  join public.planning_rounds pr on pr.id = ps.round_id
  where ps.id = p_suggestion;

  if gid is null or not public.is_active_member(gid) then
    raise exception 'NOT_FOUND';
  end if;
  if rst <> 'open' or st <> 'active' then
    raise exception 'ROUND_CLOSED';
  end if;

  if p_selected then
    -- A bare `do nothing` is required here: naming the conflict target would
    -- reference `suggestion_id`, which is also this function's RETURNS TABLE
    -- output column, and PL/pgSQL rejects that as ambiguous (42702). The
    -- primary key still gives VOT-004 idempotency.
    insert into public.suggestion_votes (suggestion_id, user_id)
    values (p_suggestion, uid)
    on conflict do nothing;

    -- NOT-006: at most one unread vote-activity notification per user and round.
    for m in select gm.user_id from public.group_members gm
             where gm.group_id = gid and gm.left_at is null
    loop
      perform public.push_notification(
        m.user_id, 'vote_activity', uid, gid, rid, '{}'::jsonb, 'vote_activity:' || rid::text
      );
    end loop;
  else
    delete from public.suggestion_votes v
      where v.suggestion_id = p_suggestion and v.user_id = uid;
  end if;

  suggestion_id := p_suggestion;
  -- VOT-008 / "member removed before closure": only active members count.
  votes := (
    select count(*)::int
    from public.suggestion_votes v
    join public.group_members gm on gm.user_id = v.user_id and gm.group_id = gid and gm.left_at is null
    where v.suggestion_id = p_suggestion
  );
  selected := exists (
    select 1 from public.suggestion_votes v where v.suggestion_id = p_suggestion and v.user_id = uid
  );
  return next;
end;
$$;

-- VOT-006..VOT-008 + CNF-001..CNF-003: close voting, validate the leader, and
-- create exactly one confirmed plan with a pending attendance row per member.
create or replace function public.close_planning_round(p_round uuid, p_winner uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid        uuid := public.require_uid();
  rnd        public.planning_rounds;
  win        public.plan_suggestions;
  top_votes  int;
  win_votes  int;
  new_plan   uuid;
  m          record;
begin
  select * into rnd from public.planning_rounds where id = p_round for update;
  if rnd.id is null or not public.is_active_member(rnd.group_id) then
    raise exception 'NOT_FOUND';
  end if;
  if not public.is_group_admin(rnd.group_id) then
    raise exception 'FORBIDDEN';
  end if;
  -- Concurrent closes: the second transaction sees a non-open round.
  if rnd.status <> 'open' then
    raise exception 'ROUND_CLOSED';
  end if;

  select * into win from public.plan_suggestions
    where id = p_winner and round_id = p_round and status = 'active';
  if win.id is null then
    raise exception 'NOT_FOUND';
  end if;

  select coalesce(max(t.votes), 0) into top_votes
  from (
    select count(v.user_id)::int as votes
    from public.plan_suggestions ps
    left join public.suggestion_votes v on v.suggestion_id = ps.id
    left join public.group_members gm
      on gm.user_id = v.user_id and gm.group_id = rnd.group_id and gm.left_at is null
    where ps.round_id = p_round and ps.status = 'active' and (v.user_id is null or gm.user_id is not null)
    group by ps.id
  ) t;

  select count(v.user_id)::int into win_votes
  from public.suggestion_votes v
  join public.group_members gm on gm.user_id = v.user_id and gm.group_id = rnd.group_id and gm.left_at is null
  where v.suggestion_id = p_winner;

  -- VOT-007/VOT-008: only a leader may win, unless every option has zero votes.
  if top_votes > 0 and win_votes < top_votes then
    raise exception 'VALIDATION_ERROR';
  end if;

  insert into public.confirmed_plans (
    group_id, round_id, winning_suggestion_id, confirmed_by,
    category, title, description, start_at, end_at, location, external_url
  )
  values (
    rnd.group_id, p_round, win.id, uid,
    win.category, win.title, win.description, win.proposed_start_at, win.proposed_end_at,
    win.location, win.external_url
  )
  returning id into new_plan;

  update public.planning_rounds
    set status = 'confirmed', closed_by = uid, closed_at = now()
    where id = p_round;

  -- CNF-003: every active member at this moment gets a pending row.
  insert into public.plan_attendees (confirmed_plan_id, user_id)
  select new_plan, gm.user_id
  from public.group_members gm
  where gm.group_id = rnd.group_id and gm.left_at is null
  on conflict do nothing;

  for m in select gm.user_id from public.group_members gm
           where gm.group_id = rnd.group_id and gm.left_at is null
  loop
    perform public.push_notification(
      m.user_id, 'plan_confirmed', uid, rnd.group_id, new_plan,
      jsonb_build_object('category', win.category), 'plan_confirmed:' || new_plan::text
    );
    -- NOT-002: the RSVP task goes to everyone, including the closing admin, so
    -- push it directly rather than through the actor-suppressing helper.
    insert into public.notifications (user_id, type, actor_id, group_id, entity_id, payload, dedupe_key)
    values (m.user_id, 'rsvp_required', null, rnd.group_id, new_plan, '{}'::jsonb, 'rsvp:' || new_plan::text)
    on conflict (user_id, dedupe_key) do nothing;
  end loop;

  return new_plan;
end;
$$;

-- GRP-004: an admin cancels an open round without confirming anything.
create or replace function public.cancel_planning_round(p_round uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := public.require_uid();
  rnd public.planning_rounds;
begin
  select * into rnd from public.planning_rounds where id = p_round for update;
  if rnd.id is null or not public.is_active_member(rnd.group_id) then
    raise exception 'NOT_FOUND';
  end if;
  if not public.is_group_admin(rnd.group_id) then
    raise exception 'FORBIDDEN';
  end if;
  if rnd.status <> 'open' then
    raise exception 'ROUND_CLOSED';
  end if;

  update public.planning_rounds
    set status = 'cancelled', closed_by = uid, closed_at = now()
    where id = p_round;
end;
$$;

-- ===========================================================================
-- Attendance
-- ===========================================================================

-- CNF-004/CNF-009: a member answers for themselves and may change the answer
-- while the plan is still scheduled. Late joiners get their row created here.
create or replace function public.respond_attendance(p_plan uuid, p_status public.attendance_status)
returns public.plan_attendees
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid    uuid := public.require_uid();
  plan   public.confirmed_plans;
  result public.plan_attendees;
begin
  if p_status not in ('going', 'not_going') then
    raise exception 'VALIDATION_ERROR';
  end if;

  select * into plan from public.confirmed_plans where id = p_plan;
  if plan.id is null or not public.is_active_member(plan.group_id) then
    raise exception 'NOT_FOUND';
  end if;
  if plan.status <> 'scheduled' then
    raise exception 'CONFLICT';
  end if;

  insert into public.plan_attendees (confirmed_plan_id, user_id, status, responded_at)
  values (p_plan, uid, p_status, now())
  on conflict (confirmed_plan_id, user_id) do update
    set status = excluded.status, responded_at = now()
  returning * into result;

  return result;
end;
$$;

-- CNF-007: an admin cancels a scheduled plan; the record stays visible and
-- reminders stop.
create or replace function public.cancel_confirmed_plan(p_plan uuid, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid  uuid := public.require_uid();
  plan public.confirmed_plans;
  m    record;
begin
  select * into plan from public.confirmed_plans where id = p_plan for update;
  if plan.id is null or not public.is_active_member(plan.group_id) then
    raise exception 'NOT_FOUND';
  end if;
  if not public.is_group_admin(plan.group_id) then
    raise exception 'FORBIDDEN';
  end if;
  if plan.status <> 'scheduled' then
    raise exception 'CONFLICT';
  end if;

  update public.confirmed_plans
    set status = 'cancelled',
        cancelled_at = now(),
        cancellation_reason = nullif(btrim(coalesce(p_reason, '')), '')
    where id = p_plan;

  -- §7.4: listed attendees except the actor.
  for m in select pa.user_id from public.plan_attendees pa where pa.confirmed_plan_id = p_plan
  loop
    perform public.push_notification(
      m.user_id, 'plan_cancelled', uid, plan.group_id, p_plan, '{}'::jsonb,
      'plan_cancelled:' || p_plan::text
    );
  end loop;
end;
$$;

-- ===========================================================================
-- Notifications
-- ===========================================================================

create or replace function public.mark_notification_read(p_notification uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := public.require_uid();
begin
  update public.notifications
    set read_at = coalesce(read_at, now())
    where id = p_notification and user_id = uid;
end;
$$;

create or replace function public.mark_all_notifications_read()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := public.require_uid();
begin
  update public.notifications set read_at = now() where user_id = uid and read_at is null;
end;
$$;

-- ===========================================================================
-- Scheduled work — §9.9. Idempotent, safe to retry, called hourly by the cron
-- route with the service role.
-- ===========================================================================
create or replace function public.run_scheduled_jobs()
returns table (completed int, reminders int)
language plpgsql
security definer
set search_path = ''
as $$
declare
  n_completed int := 0;
  n_reminders int := 0;
  r           record;
begin
  -- 1. Plans whose end time has passed become completed.
  with done as (
    update public.confirmed_plans
      set status = 'completed'
      where status = 'scheduled' and end_at <= now()
      returning 1
  )
  select count(*)::int into n_completed from done;

  -- 2. One 24-hour reminder per pending/going attendee who is still active.
  for r in
    select pa.user_id, cp.id as plan_id, cp.group_id, cp.category
    from public.confirmed_plans cp
    join public.plan_attendees pa on pa.confirmed_plan_id = cp.id
    join public.group_members gm
      on gm.group_id = cp.group_id and gm.user_id = pa.user_id and gm.left_at is null
    join public.groups g on g.id = cp.group_id and g.deleted_at is null
    where cp.status = 'scheduled'
      and pa.status in ('pending', 'going')
      and cp.start_at between now() + interval '23 hours' and now() + interval '25 hours'
  loop
    insert into public.notifications (user_id, type, actor_id, group_id, entity_id, payload, dedupe_key)
    values (
      r.user_id, 'plan_reminder_24h', null, r.group_id, r.plan_id,
      jsonb_build_object('category', r.category), 'reminder24:' || r.plan_id::text
    )
    on conflict (user_id, dedupe_key) do nothing;
    n_reminders := n_reminders + 1;
  end loop;

  completed := n_completed;
  reminders := n_reminders;
  return next;
end;
$$;

-- ---------------------------------------------------------------------------
-- Execution grants. Internal helpers stay server-side only.
-- ---------------------------------------------------------------------------
revoke all on function public.push_notification(uuid, public.notification_type, uuid, uuid, uuid, jsonb, text) from public, anon, authenticated;
revoke all on function public.run_scheduled_jobs() from public, anon, authenticated;
revoke all on function public.next_member_color(uuid) from public, anon, authenticated;

grant execute on function public.complete_profile(text, text, text)                       to authenticated;
grant execute on function public.search_users(text, int)                                  to authenticated;
grant execute on function public.send_friend_request(uuid)                                to authenticated;
grant execute on function public.respond_friend_request(uuid, boolean)                    to authenticated;
grant execute on function public.remove_friend(uuid)                                      to authenticated;
grant execute on function public.create_group(text, text)                                 to authenticated;
grant execute on function public.rotate_group_invite(uuid)                                to authenticated;
grant execute on function public.redeem_group_invite(text)                                to authenticated;
grant execute on function public.change_member_role(uuid, uuid, public.group_role)        to authenticated;
grant execute on function public.remove_group_member(uuid, uuid)                          to authenticated;
grant execute on function public.leave_group(uuid)                                        to authenticated;
grant execute on function public.delete_group(uuid)                                       to authenticated;
grant execute on function public.replace_availability(uuid, jsonb, timestamptz, timestamptz) to authenticated;
grant execute on function public.open_planning_round(uuid, timestamptz, timestamptz, public.plan_category, text, text, timestamptz, timestamptz, text, text) to authenticated;
grant execute on function public.add_suggestion(uuid, public.plan_category, text, text, timestamptz, timestamptz, text, text) to authenticated;
grant execute on function public.withdraw_suggestion(uuid)                                to authenticated;
grant execute on function public.set_suggestion_vote(uuid, boolean)                       to authenticated;
grant execute on function public.close_planning_round(uuid, uuid)                         to authenticated;
grant execute on function public.cancel_planning_round(uuid)                              to authenticated;
grant execute on function public.respond_attendance(uuid, public.attendance_status)       to authenticated;
grant execute on function public.cancel_confirmed_plan(uuid, text)                        to authenticated;
grant execute on function public.mark_notification_read(uuid)                             to authenticated;
grant execute on function public.mark_all_notifications_read()                            to authenticated;
grant execute on function public.run_scheduled_jobs()                                     to service_role;
