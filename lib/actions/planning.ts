"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { fail, mapPostgresError, ok, type ActionResult } from "@/lib/domain/errors";
import {
  addSuggestionSchema,
  closeRoundSchema,
  firstIssue,
  openPlanningRoundSchema,
  setVoteSchema,
  uuidSchema,
} from "@/lib/domain/schemas";
import type { PlanCategory } from "@/lib/domain/types";

/** PLN-001..PLN-004 — the round and its first suggestion are created together. */
export async function openPlanningRound(input: {
  groupId: string;
  windowStartAt: string;
  windowEndAt: string;
  suggestion: {
    category: string;
    title: string;
    description?: string | null;
    proposedStartAt: string;
    proposedEndAt: string;
    location?: string | null;
    externalUrl?: string | null;
  };
}): Promise<ActionResult<{ roundId: string }>> {
  const parsed = openPlanningRoundSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION_ERROR", firstIssue(parsed.error).field);

  const s = parsed.data.suggestion;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("open_planning_round", {
    p_group: parsed.data.groupId,
    p_window_start: parsed.data.windowStartAt,
    p_window_end: parsed.data.windowEndAt,
    p_category: s.category as PlanCategory,
    p_title: s.title,
    p_description: s.description ?? null,
    p_start_at: s.proposedStartAt,
    p_end_at: s.proposedEndAt,
    p_location: s.location ?? null,
    p_external_url: s.externalUrl ?? null,
  });
  if (error) return { ok: false, error: mapPostgresError(error) };

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return fail("NETWORK_ERROR");

  revalidatePath(`/groups/${parsed.data.groupId}`);
  revalidatePath("/home");
  return ok({ roundId: row.round_id });
}

/** PLN-005/PLN-006 — any active member adds an option while the round is open. */
export async function addSuggestion(input: {
  roundId: string;
  category: string;
  title: string;
  description?: string | null;
  proposedStartAt: string;
  proposedEndAt: string;
  location?: string | null;
  externalUrl?: string | null;
}): Promise<ActionResult<{ id: string }>> {
  const parsed = addSuggestionSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION_ERROR", firstIssue(parsed.error).field);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("add_suggestion", {
    p_round: parsed.data.roundId,
    p_category: parsed.data.category as PlanCategory,
    p_title: parsed.data.title,
    p_description: parsed.data.description ?? null,
    p_start_at: parsed.data.proposedStartAt,
    p_end_at: parsed.data.proposedEndAt,
    p_location: parsed.data.location ?? null,
    p_external_url: parsed.data.externalUrl ?? null,
  });
  if (error) return { ok: false, error: mapPostgresError(error) };

  revalidatePath("/groups", "layout");
  return ok({ id: (data as { id: string }).id });
}

/** PLN-008 — the creator withdraws; votes leave the tally, history remains. */
export async function withdrawSuggestion(suggestionId: string): Promise<ActionResult<null>> {
  if (!uuidSchema.safeParse(suggestionId).success) return fail("VALIDATION_ERROR");

  const supabase = await createClient();
  const { error } = await supabase.rpc("withdraw_suggestion", { p_suggestion: suggestionId });
  if (error) return { ok: false, error: mapPostgresError(error) };

  return ok(null);
}

/** VOT-001..VOT-005 — idempotent toggle returning the authoritative tally. */
export async function setSuggestionVote(input: {
  suggestionId: string;
  selected: boolean;
}): Promise<ActionResult<{ votes: number; selected: boolean }>> {
  const parsed = setVoteSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION_ERROR");

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("set_suggestion_vote", {
    p_suggestion: parsed.data.suggestionId,
    p_selected: parsed.data.selected,
  });
  if (error) return { ok: false, error: mapPostgresError(error) };

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return fail("NETWORK_ERROR");
  return ok({ votes: row.votes, selected: row.selected });
}

/** VOT-006..VOT-008 + CNF-001 — close voting and confirm exactly one plan. */
export async function closePlanningRound(input: {
  roundId: string;
  winningSuggestionId: string;
}): Promise<ActionResult<{ planId: string }>> {
  const parsed = closeRoundSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION_ERROR");

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("close_planning_round", {
    p_round: parsed.data.roundId,
    p_winner: parsed.data.winningSuggestionId,
  });
  if (error) return { ok: false, error: mapPostgresError(error) };

  revalidatePath("/home");
  revalidatePath("/calendar");
  return ok({ planId: data as unknown as string });
}

/** GRP-004 — an admin cancels an open round. */
export async function cancelPlanningRound(roundId: string): Promise<ActionResult<null>> {
  if (!uuidSchema.safeParse(roundId).success) return fail("VALIDATION_ERROR");

  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_planning_round", { p_round: roundId });
  if (error) return { ok: false, error: mapPostgresError(error) };

  revalidatePath("/home");
  return ok(null);
}
