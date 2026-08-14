/**
 * Hand-maintained mirror of the SQL in `supabase/migrations`.
 *
 * Regenerate with the Supabase CLI once the project is linked:
 *   npx supabase gen types typescript --linked > lib/supabase/database.types.ts
 * Until then this file is the source of truth for client typing — keep it in
 * step with the migrations.
 */

import type {
  AttendanceStatus,
  ConfirmedPlanStatus,
  FriendshipStatus,
  GroupRole,
  NotificationType,
  PlanCategory,
  PlanningRoundStatus,
  SuggestionStatus,
} from "@/lib/domain/types";

type Timestamps = { created_at: string; updated_at: string };

export type ProfileRow = {
  id: string;
  username: string;
  display_name: string;
  avatar_path: string | null;
  onboarding_completed_at: string | null;
} & Timestamps;

export type FriendshipRow = {
  id: string;
  requester_id: string;
  receiver_id: string;
  status: FriendshipStatus;
  responded_at: string | null;
} & Timestamps;

export type GroupRow = {
  id: string;
  name: string;
  image_path: string | null;
  created_by: string;
  timezone: string;
  deleted_at: string | null;
} & Timestamps;

export type GroupMemberRow = {
  group_id: string;
  user_id: string;
  role: GroupRole;
  assigned_color: number;
  joined_at: string;
  left_at: string | null;
};

export type GroupInviteRow = {
  id: string;
  group_id: string;
  token_hash: string;
  created_by: string;
  expires_at: string;
  revoked_at: string | null;
  created_at: string;
};

export type AvailabilitySlotRow = {
  id: string;
  group_id: string;
  user_id: string;
  start_at: string;
  end_at: string;
} & Timestamps;

export type PlanningRoundRow = {
  id: string;
  group_id: string;
  created_by: string;
  window_start_at: string;
  window_end_at: string;
  status: PlanningRoundStatus;
  closed_by: string | null;
  closed_at: string | null;
} & Timestamps;

export type PlanSuggestionRow = {
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
  withdrawn_at: string | null;
  created_at: string;
};

export type SuggestionVoteRow = {
  suggestion_id: string;
  user_id: string;
  created_at: string;
};

export type ConfirmedPlanRow = {
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
  cancelled_at: string | null;
} & Timestamps;

export type PlanAttendeeRow = {
  confirmed_plan_id: string;
  user_id: string;
  status: AttendanceStatus;
  responded_at: string | null;
} & Timestamps;

export type NotificationRow = {
  id: string;
  user_id: string;
  type: NotificationType;
  actor_id: string | null;
  group_id: string | null;
  entity_id: string | null;
  payload: Record<string, unknown>;
  dedupe_key: string;
  read_at: string | null;
  created_at: string;
};

type Table<Row, Insert = Partial<Row>, Update = Partial<Row>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      profiles: Table<ProfileRow>;
      friendships: Table<FriendshipRow>;
      groups: Table<GroupRow>;
      group_members: Table<GroupMemberRow>;
      group_invites: Table<GroupInviteRow>;
      availability_slots: Table<AvailabilitySlotRow>;
      planning_rounds: Table<PlanningRoundRow>;
      plan_suggestions: Table<PlanSuggestionRow>;
      suggestion_votes: Table<SuggestionVoteRow>;
      confirmed_plans: Table<ConfirmedPlanRow>;
      plan_attendees: Table<PlanAttendeeRow>;
      notifications: Table<NotificationRow>;
    };
    Views: Record<never, never>;
    Functions: {
      complete_profile: {
        Args: { p_display_name: string; p_username: string; p_avatar_path?: string | null };
        Returns: ProfileRow;
      };
      search_users: {
        Args: { p_query: string; p_limit?: number };
        Returns: { id: string; username: string; display_name: string; avatar_path: string | null }[];
      };
      send_friend_request: { Args: { p_target: string }; Returns: FriendshipRow };
      respond_friend_request: { Args: { p_friendship: string; p_accept: boolean }; Returns: FriendshipRow };
      remove_friend: { Args: { p_friendship: string }; Returns: undefined };
      create_group: {
        Args: { p_name: string; p_image_path?: string | null };
        Returns: { group_id: string; invite_token: string }[];
      };
      rotate_group_invite: { Args: { p_group: string }; Returns: string };
      redeem_group_invite: { Args: { p_token: string }; Returns: string };
      change_member_role: { Args: { p_group: string; p_user: string; p_role: GroupRole }; Returns: undefined };
      remove_group_member: { Args: { p_group: string; p_user: string }; Returns: undefined };
      leave_group: { Args: { p_group: string }; Returns: undefined };
      delete_group: { Args: { p_group: string }; Returns: undefined };
      replace_availability: {
        Args: {
          p_group: string;
          p_intervals: { startAt: string; endAt: string }[];
          p_range_start: string;
          p_range_end: string;
        };
        Returns: AvailabilitySlotRow[];
      };
      open_planning_round: {
        Args: {
          p_group: string;
          p_window_start: string;
          p_window_end: string;
          p_category: PlanCategory;
          p_title: string;
          p_description: string | null;
          p_start_at: string;
          p_end_at: string;
          p_location: string | null;
          p_external_url: string | null;
        };
        Returns: { round_id: string; suggestion_id: string }[];
      };
      add_suggestion: {
        Args: {
          p_round: string;
          p_category: PlanCategory;
          p_title: string;
          p_description: string | null;
          p_start_at: string;
          p_end_at: string;
          p_location: string | null;
          p_external_url: string | null;
        };
        Returns: PlanSuggestionRow;
      };
      withdraw_suggestion: { Args: { p_suggestion: string }; Returns: undefined };
      set_suggestion_vote: {
        Args: { p_suggestion: string; p_selected: boolean };
        Returns: { suggestion_id: string; votes: number; selected: boolean }[];
      };
      close_planning_round: { Args: { p_round: string; p_winner: string }; Returns: string };
      cancel_planning_round: { Args: { p_round: string }; Returns: undefined };
      respond_attendance: {
        Args: { p_plan: string; p_status: AttendanceStatus };
        Returns: PlanAttendeeRow;
      };
      respond_attendance_resolving: {
        Args: { p_plan: string; p_status: AttendanceStatus; p_withdraw_from?: string[] };
        Returns: PlanAttendeeRow;
      };
      attendance_conflicts: {
        Args: { p_plan: string };
        Returns: {
          plan_id: string;
          title: string;
          start_at: string;
          end_at: string;
          group_name: string;
        }[];
      };
      cancel_confirmed_plan: { Args: { p_plan: string; p_reason?: string | null }; Returns: undefined };
      mark_notification_read: { Args: { p_notification: string }; Returns: undefined };
      mark_all_notifications_read: { Args: Record<never, never>; Returns: undefined };
      run_scheduled_jobs: { Args: Record<never, never>; Returns: { completed: number; reminders: number }[] };
    };
    Enums: {
      group_role: GroupRole;
      friendship_status: FriendshipStatus;
      planning_round_status: PlanningRoundStatus;
      suggestion_status: SuggestionStatus;
      confirmed_plan_status: ConfirmedPlanStatus;
      attendance_status: AttendanceStatus;
      plan_category: PlanCategory;
      notification_type: NotificationType;
    };
    CompositeTypes: Record<never, never>;
  };
};
