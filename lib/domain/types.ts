/** Domain types — PRD §9.2. Identifiers and DB values stay English (§8.1). */

export type GroupRole = "owner" | "admin" | "member";
export type FriendshipStatus = "pending" | "accepted" | "rejected" | "cancelled";
export type PlanningRoundStatus = "open" | "confirmed" | "cancelled";
export type SuggestionStatus = "active" | "withdrawn";
export type ConfirmedPlanStatus = "scheduled" | "completed" | "cancelled";
export type AttendanceStatus = "pending" | "going" | "not_going";

export type PlanCategory =
  | "food"
  | "cinema"
  | "padel"
  | "football"
  | "coffee"
  | "gaming"
  | "istiraha"
  | "outing"
  | "shopping"
  | "bowling"
  | "other";

export type NotificationType =
  | "friend_request"
  | "full_overlap"
  | "near_overlap"
  | "suggestion_created"
  | "vote_activity"
  | "plan_confirmed"
  | "rsvp_required"
  | "plan_cancelled"
  | "plan_reminder_24h";

/** PLN-007 categories, with the prototype's Arabic label and Phosphor icon. */
export const PLAN_CATEGORIES: Record<PlanCategory, { ar: string; icon: string }> = {
  food: { ar: "أكل", icon: "ph-hamburger" },
  cinema: { ar: "سينما", icon: "ph-film-slate" },
  padel: { ar: "بادل", icon: "ph-tennis-ball" },
  football: { ar: "كورة", icon: "ph-soccer-ball" },
  coffee: { ar: "قهوة", icon: "ph-coffee" },
  gaming: { ar: "قيمنق", icon: "ph-game-controller" },
  istiraha: { ar: "استراحة", icon: "ph-house-line" },
  outing: { ar: "طلعة", icon: "ph-car-profile" },
  shopping: { ar: "تسوق", icon: "ph-shopping-bag" },
  bowling: { ar: "بولينق", icon: "ph-bowling-ball" },
  other: { ar: "غيره", icon: "ph-plus-circle" },
};

export const PLAN_CATEGORY_IDS = Object.keys(PLAN_CATEGORIES) as PlanCategory[];

/** BR-002 / AVL-004: one fixed group timezone and a 28-day planning horizon. */
export const GROUP_TIMEZONE = "Asia/Riyadh";
export const PLANNING_HORIZON_DAYS = 28;

/** GRP-003 / OVL-003 / OVL-006 hard limits. */
export const MAX_GROUP_MEMBERS = 30;
export const MIN_OVERLAP_MINUTES = 60;
export const NEAR_MATCH_RATIO = 0.75;
export const NEAR_MATCH_MIN_MEMBERS = 3;
export const MAX_RANKED_OVERLAPS = 3;

export type Profile = {
  id: string;
  username: string;
  display_name: string;
  avatar_path: string | null;
  onboarding_completed_at: string | null;
};

/** The minimal projection non-friends may see through search/member lists. */
export type PublicProfile = Pick<Profile, "id" | "username" | "display_name" | "avatar_path">;

export type Group = {
  id: string;
  name: string;
  image_path: string | null;
  created_by: string;
  timezone: string;
  created_at: string;
};

export type GroupMember = {
  group_id: string;
  user_id: string;
  role: GroupRole;
  assigned_color: number;
  joined_at: string;
  left_at: string | null;
  profile: PublicProfile;
};

export type AvailabilitySlot = {
  id: string;
  group_id: string;
  user_id: string;
  start_at: string;
  end_at: string;
};

export type Interval = { startAt: Date; endAt: Date };

export type PlanningRound = {
  id: string;
  group_id: string;
  created_by: string;
  window_start_at: string;
  window_end_at: string;
  status: PlanningRoundStatus;
  closed_by: string | null;
  closed_at: string | null;
};

export type PlanSuggestion = {
  id: string;
  round_id: string;
  suggested_by: string;
  category: PlanCategory;
  title: string;
  description: string | null;
  proposed_start_at: string;
  proposed_end_at: string;
  location: string | null;
  external_url: string | null;
  status: SuggestionStatus;
};

export type ConfirmedPlan = {
  id: string;
  group_id: string;
  round_id: string;
  winning_suggestion_id: string;
  confirmed_by: string;
  category: PlanCategory;
  title: string;
  description: string | null;
  start_at: string;
  end_at: string;
  location: string | null;
  external_url: string | null;
  status: ConfirmedPlanStatus;
  cancellation_reason: string | null;
};

export type PlanAttendee = {
  confirmed_plan_id: string;
  user_id: string;
  status: AttendanceStatus;
  responded_at: string | null;
};

export type AppNotification = {
  id: string;
  user_id: string;
  type: NotificationType;
  actor_id: string | null;
  group_id: string | null;
  entity_id: string | null;
  payload: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
};

/** A ranked overlap produced by the sweep in `lib/domain/overlap.ts` (§9.7). */
export type OverlapSlot = {
  startAt: Date;
  endAt: Date;
  memberIds: string[];
  availableCount: number;
  totalActiveMembers: number;
  isFullMatch: boolean;
  isNearMatch: boolean;
  durationMinutes: number;
};
