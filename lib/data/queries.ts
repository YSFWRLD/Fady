import "server-only";

import { createClient } from "@/lib/supabase/server";
import { computeOverlaps, type MemberInterval } from "@/lib/domain/overlap";
import { addDays } from "@/lib/domain/format";
import {
  PLANNING_HORIZON_DAYS,
  type AttendanceStatus,
  type ConfirmedPlanStatus,
  type GroupRole,
  type OverlapSlot,
  type PlanCategory,
  type PlanningRoundStatus,
} from "@/lib/domain/types";

/**
 * Every read here runs under the caller's session, so RLS is the authorization
 * boundary (BR-006). An unauthorized id simply returns nothing, which the pages
 * render as the same member-safe not-found state (§5.3).
 */

export type MemberView = {
  userId: string;
  role: GroupRole;
  color: number;
  displayName: string;
  username: string;
  avatarPath: string | null;
};

export type GroupSummary = {
  id: string;
  name: string;
  imagePath: string | null;
  memberCount: number;
  role: GroupRole;
  color: number;
};

export async function getMyGroups(): Promise<GroupSummary[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: memberships } = await supabase
    .from("group_members")
    .select("group_id, role, assigned_color")
    .eq("user_id", user.id)
    .is("left_at", null);

  const groupIds = (memberships ?? []).map((m) => m.group_id);
  if (groupIds.length === 0) return [];

  const [{ data: groups }, { data: allMembers }] = await Promise.all([
    supabase.from("groups").select("id, name, image_path").in("id", groupIds).is("deleted_at", null),
    supabase.from("group_members").select("group_id").in("group_id", groupIds).is("left_at", null),
  ]);

  const counts = new Map<string, number>();
  for (const m of allMembers ?? []) counts.set(m.group_id, (counts.get(m.group_id) ?? 0) + 1);

  return (groups ?? []).map((g) => {
    const membership = memberships!.find((m) => m.group_id === g.id)!;
    return {
      id: g.id,
      name: g.name,
      imagePath: g.image_path,
      memberCount: counts.get(g.id) ?? 1,
      role: membership.role,
      color: membership.assigned_color,
    };
  });
}

export async function getGroupMembers(groupId: string): Promise<MemberView[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("group_members")
    .select("user_id, role, assigned_color")
    .eq("group_id", groupId)
    .is("left_at", null);

  const rows = data ?? [];
  if (rows.length === 0) return [];

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_path")
    .in(
      "id",
      rows.map((r) => r.user_id),
    );

  const byId = new Map((profiles ?? []).map((p) => [p.id, p]));
  return rows
    .map((r) => {
      const p = byId.get(r.user_id);
      return {
        userId: r.user_id,
        role: r.role,
        color: r.assigned_color,
        displayName: p?.display_name ?? "عضو",
        username: p?.username ?? "",
        avatarPath: p?.avatar_path ?? null,
      };
    })
    .sort((a, b) => {
      const rank = { owner: 0, admin: 1, member: 2 } as const;
      return rank[a.role] - rank[b.role] || a.displayName.localeCompare(b.displayName, "ar");
    });
}

export type GroupCalendar = {
  members: MemberView[];
  slots: { userId: string; startAt: Date; endAt: Date }[];
  overlaps: OverlapSlot[];
};

/** getGroupCalendar + getRankedOverlaps (§9.6), capped at the 28-day horizon. */
export async function getGroupCalendar(groupId: string, from = new Date()): Promise<GroupCalendar> {
  const supabase = await createClient();
  const rangeEnd = addDays(from, PLANNING_HORIZON_DAYS);

  const [members, { data: slotRows }] = await Promise.all([
    getGroupMembers(groupId),
    supabase
      .from("availability_slots")
      .select("user_id, start_at, end_at")
      .eq("group_id", groupId)
      .gt("end_at", from.toISOString())
      .lt("start_at", rangeEnd.toISOString())
      .order("start_at"),
  ]);

  const slots = (slotRows ?? []).map((s) => ({
    userId: s.user_id,
    startAt: new Date(s.start_at),
    endAt: new Date(s.end_at),
  }));

  const intervals: MemberInterval[] = slots.map((s) => ({ userId: s.userId, startAt: s.startAt, endAt: s.endAt }));
  const overlaps =
    members.length === 0
      ? []
      : computeOverlaps({
          intervals,
          activeMemberIds: members.map((m) => m.userId),
          rangeStart: from,
          rangeEnd,
          now: from,
        });

  return { members, slots, overlaps };
}

export type RoundView = {
  id: string;
  groupId: string;
  groupName: string;
  status: PlanningRoundStatus;
  windowStartAt: Date;
  windowEndAt: Date;
  createdBy: string;
  viewerIsAdmin: boolean;
  availableCount: number;
  totalMembers: number;
  suggestions: {
    id: string;
    category: PlanCategory;
    title: string;
    description: string | null;
    location: string | null;
    externalUrl: string | null;
    startAt: Date;
    endAt: Date;
    suggestedBy: string;
    suggestedByName: string;
    votes: number;
    mine: boolean;
    isOwn: boolean;
  }[];
  confirmedPlanId: string | null;
};

export async function getRound(roundId: string): Promise<RoundView | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: round } = await supabase
    .from("planning_rounds")
    .select("id, group_id, status, window_start_at, window_end_at, created_by")
    .eq("id", roundId)
    .maybeSingle();
  if (!round) return null;

  const [{ data: group }, members, { data: suggestions }, { data: plan }] = await Promise.all([
    supabase.from("groups").select("name").eq("id", round.group_id).maybeSingle(),
    getGroupMembers(round.group_id),
    supabase
      .from("plan_suggestions")
      .select(
        "id, category, title, description, location, external_url, proposed_start_at, proposed_end_at, suggested_by, status",
      )
      .eq("round_id", roundId)
      .eq("status", "active")
      .order("created_at"),
    supabase.from("confirmed_plans").select("id").eq("round_id", roundId).maybeSingle(),
  ]);

  const suggestionIds = (suggestions ?? []).map((s) => s.id);
  const { data: votes } = suggestionIds.length
    ? await supabase.from("suggestion_votes").select("suggestion_id, user_id").in("suggestion_id", suggestionIds)
    : { data: [] as { suggestion_id: string; user_id: string }[] };

  const activeIds = new Set(members.map((m) => m.userId));
  const tallies = new Map<string, number>();
  const mine = new Set<string>();
  for (const v of votes ?? []) {
    // A member removed before closure no longer counts toward the tally.
    if (!activeIds.has(v.user_id)) continue;
    tallies.set(v.suggestion_id, (tallies.get(v.suggestion_id) ?? 0) + 1);
    if (v.user_id === user.id) mine.add(v.suggestion_id);
  }

  const viewer = members.find((m) => m.userId === user.id);
  const nameById = new Map(members.map((m) => [m.userId, m.displayName]));

  // PLN-010: exact count of members free for the whole window.
  const windowStart = new Date(round.window_start_at);
  const windowEnd = new Date(round.window_end_at);
  const { data: slotRows } = await supabase
    .from("availability_slots")
    .select("user_id, start_at, end_at")
    .eq("group_id", round.group_id)
    .lte("start_at", windowStart.toISOString())
    .gte("end_at", windowEnd.toISOString());

  const availableIds = new Set(
    (slotRows ?? []).filter((s) => activeIds.has(s.user_id)).map((s) => s.user_id),
  );

  return {
    id: round.id,
    groupId: round.group_id,
    groupName: group?.name ?? "",
    status: round.status,
    windowStartAt: windowStart,
    windowEndAt: windowEnd,
    createdBy: round.created_by,
    viewerIsAdmin: viewer?.role === "owner" || viewer?.role === "admin",
    availableCount: availableIds.size,
    totalMembers: members.length,
    confirmedPlanId: plan?.id ?? null,
    suggestions: (suggestions ?? []).map((s) => ({
      id: s.id,
      category: s.category,
      title: s.title,
      description: s.description,
      location: s.location,
      externalUrl: s.external_url,
      startAt: new Date(s.proposed_start_at),
      endAt: new Date(s.proposed_end_at),
      suggestedBy: s.suggested_by,
      suggestedByName: nameById.get(s.suggested_by) ?? "عضو",
      votes: tallies.get(s.id) ?? 0,
      mine: mine.has(s.id),
      isOwn: s.suggested_by === user.id,
    })),
  };
}

export type PlanView = {
  id: string;
  groupId: string;
  groupName: string;
  roundId: string;
  category: PlanCategory;
  title: string;
  description: string | null;
  location: string | null;
  externalUrl: string | null;
  startAt: Date;
  endAt: Date;
  status: ConfirmedPlanStatus;
  cancellationReason: string | null;
  viewerIsAdmin: boolean;
  myStatus: AttendanceStatus | null;
  attendees: { userId: string; name: string; color: number; status: AttendanceStatus }[];
};

export async function getPlan(planId: string): Promise<PlanView | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: plan } = await supabase.from("confirmed_plans").select("*").eq("id", planId).maybeSingle();
  if (!plan) return null;

  const [{ data: group }, members, { data: attendees }] = await Promise.all([
    supabase.from("groups").select("name").eq("id", plan.group_id).maybeSingle(),
    getGroupMembers(plan.group_id),
    supabase.from("plan_attendees").select("user_id, status").eq("confirmed_plan_id", planId),
  ]);

  const byId = new Map(members.map((m) => [m.userId, m]));
  const viewer = byId.get(user.id);

  return {
    id: plan.id,
    groupId: plan.group_id,
    groupName: group?.name ?? "",
    roundId: plan.round_id,
    category: plan.category,
    title: plan.title,
    description: plan.description,
    location: plan.location,
    externalUrl: plan.external_url,
    startAt: new Date(plan.start_at),
    endAt: new Date(plan.end_at),
    status: plan.status,
    cancellationReason: plan.cancellation_reason,
    viewerIsAdmin: viewer?.role === "owner" || viewer?.role === "admin",
    myStatus: (attendees ?? []).find((a) => a.user_id === user.id)?.status ?? null,
    attendees: (attendees ?? [])
      .filter((a) => byId.has(a.user_id))
      .map((a) => ({
        userId: a.user_id,
        name: byId.get(a.user_id)!.displayName,
        color: byId.get(a.user_id)!.color,
        status: a.status,
      })),
  };
}

export type UpcomingPlan = {
  id: string;
  groupId: string;
  groupName: string;
  category: PlanCategory;
  title: string;
  startAt: Date;
  endAt: Date;
  status: ConfirmedPlanStatus;
  myStatus: AttendanceStatus | null;
  goingCount: number;
};

/** HOM-001 — "خطط جاية", ordered by start time. */
export async function getUpcomingPlans(limit = 10): Promise<UpcomingPlan[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: plans } = await supabase
    .from("confirmed_plans")
    .select("id, group_id, category, title, start_at, end_at, status")
    .eq("status", "scheduled")
    .gte("end_at", new Date().toISOString())
    .order("start_at")
    .limit(limit);

  if (!plans || plans.length === 0) return [];

  const planIds = plans.map((p) => p.id);
  const groupIds = [...new Set(plans.map((p) => p.group_id))];

  const [{ data: attendees }, { data: groups }] = await Promise.all([
    supabase.from("plan_attendees").select("confirmed_plan_id, user_id, status").in("confirmed_plan_id", planIds),
    supabase.from("groups").select("id, name").in("id", groupIds),
  ]);

  const groupName = new Map((groups ?? []).map((g) => [g.id, g.name]));

  return plans.map((p) => {
    const rows = (attendees ?? []).filter((a) => a.confirmed_plan_id === p.id);
    return {
      id: p.id,
      groupId: p.group_id,
      groupName: groupName.get(p.group_id) ?? "",
      category: p.category,
      title: p.title,
      startAt: new Date(p.start_at),
      endAt: new Date(p.end_at),
      status: p.status,
      myStatus: rows.find((a) => a.user_id === user.id)?.status ?? null,
      goingCount: rows.filter((a) => a.status === "going").length,
    };
  });
}

export type OpenRoundSummary = {
  id: string;
  groupId: string;
  groupName: string;
  windowStartAt: Date;
  windowEndAt: Date;
  suggestionCount: number;
  iVoted: boolean;
};

/** HOM-001 "يحتاج ردك": rounds where the viewer has not voted for anything yet. */
export async function getOpenRounds(): Promise<OpenRoundSummary[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: rounds } = await supabase
    .from("planning_rounds")
    .select("id, group_id, window_start_at, window_end_at")
    .eq("status", "open")
    .order("window_start_at");

  if (!rounds || rounds.length === 0) return [];

  const roundIds = rounds.map((r) => r.id);
  const groupIds = [...new Set(rounds.map((r) => r.group_id))];

  const [{ data: suggestions }, { data: groups }] = await Promise.all([
    supabase.from("plan_suggestions").select("id, round_id").in("round_id", roundIds).eq("status", "active"),
    supabase.from("groups").select("id, name").in("id", groupIds),
  ]);

  const suggestionIds = (suggestions ?? []).map((s) => s.id);
  const { data: myVotes } = suggestionIds.length
    ? await supabase
        .from("suggestion_votes")
        .select("suggestion_id")
        .eq("user_id", user.id)
        .in("suggestion_id", suggestionIds)
    : { data: [] as { suggestion_id: string }[] };

  const votedSuggestions = new Set((myVotes ?? []).map((v) => v.suggestion_id));
  const groupName = new Map((groups ?? []).map((g) => [g.id, g.name]));

  return rounds.map((r) => {
    const own = (suggestions ?? []).filter((s) => s.round_id === r.id);
    return {
      id: r.id,
      groupId: r.group_id,
      groupName: groupName.get(r.group_id) ?? "",
      windowStartAt: new Date(r.window_start_at),
      windowEndAt: new Date(r.window_end_at),
      suggestionCount: own.length,
      iVoted: own.some((s) => votedSuggestions.has(s.id)),
    };
  });
}

export type NotificationView = {
  id: string;
  type: string;
  groupId: string | null;
  entityId: string | null;
  payload: Record<string, unknown>;
  actorName: string | null;
  groupName: string | null;
  unread: boolean;
  createdAt: Date;
};

export async function getNotifications(limit = 20): Promise<NotificationView[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("notifications")
    .select("id, type, actor_id, group_id, entity_id, payload, read_at, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  const rows = data ?? [];
  if (rows.length === 0) return [];

  const actorIds = [...new Set(rows.map((r) => r.actor_id).filter(Boolean))] as string[];
  const groupIds = [...new Set(rows.map((r) => r.group_id).filter(Boolean))] as string[];

  const [{ data: actors }, { data: groups }] = await Promise.all([
    actorIds.length
      ? supabase.from("profiles").select("id, display_name").in("id", actorIds)
      : Promise.resolve({ data: [] as { id: string; display_name: string }[] }),
    groupIds.length
      ? supabase.from("groups").select("id, name").in("id", groupIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ]);

  const actorName = new Map((actors ?? []).map((a) => [a.id, a.display_name]));
  const groupName = new Map((groups ?? []).map((g) => [g.id, g.name]));

  return rows.map((r) => ({
    id: r.id,
    type: r.type,
    groupId: r.group_id,
    entityId: r.entity_id,
    payload: (r.payload ?? {}) as Record<string, unknown>,
    actorName: r.actor_id ? (actorName.get(r.actor_id) ?? null) : null,
    groupName: r.group_id ? (groupName.get(r.group_id) ?? null) : null,
    unread: r.read_at === null,
    createdAt: new Date(r.created_at),
  }));
}

/** NOT-001 — the header badge appears only when unread items exist. */
export async function getUnreadCount(): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .is("read_at", null);
  return count ?? 0;
}

export type FriendRow = {
  friendshipId: string;
  userId: string;
  displayName: string;
  username: string;
  avatarPath: string | null;
  direction: "incoming" | "outgoing" | "friend";
};

export async function getFriends(): Promise<FriendRow[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: rows } = await supabase
    .from("friendships")
    .select("id, requester_id, receiver_id, status")
    .in("status", ["pending", "accepted"]);

  if (!rows || rows.length === 0) return [];

  const otherIds = rows.map((r) => (r.requester_id === user.id ? r.receiver_id : r.requester_id));
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_path")
    .in("id", otherIds);

  const byId = new Map((profiles ?? []).map((p) => [p.id, p]));

  return rows.map((r) => {
    const otherId = r.requester_id === user.id ? r.receiver_id : r.requester_id;
    const p = byId.get(otherId);
    return {
      friendshipId: r.id,
      userId: otherId,
      displayName: p?.display_name ?? "عضو",
      username: p?.username ?? "",
      avatarPath: p?.avatar_path ?? null,
      direction:
        r.status === "accepted" ? ("friend" as const) : r.requester_id === user.id ? ("outgoing" as const) : ("incoming" as const),
    };
  });
}

/** AVL-011 — the personal calendar aggregates only the viewer's own entries. */
export async function getPersonalCalendar() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { slots: [], plans: [] };

  const now = new Date();
  const rangeEnd = addDays(now, PLANNING_HORIZON_DAYS);

  const [{ data: slots }, plans, groups] = await Promise.all([
    supabase
      .from("availability_slots")
      .select("id, group_id, start_at, end_at")
      .eq("user_id", user.id)
      .gt("end_at", now.toISOString())
      .lt("start_at", rangeEnd.toISOString())
      .order("start_at"),
    getUpcomingPlans(50),
    getMyGroups(),
  ]);

  const groupName = new Map(groups.map((g) => [g.id, g.name]));

  return {
    slots: (slots ?? []).map((s) => ({
      id: s.id,
      groupId: s.group_id,
      groupName: groupName.get(s.group_id) ?? "",
      startAt: new Date(s.start_at),
      endAt: new Date(s.end_at),
    })),
    plans,
  };
}
