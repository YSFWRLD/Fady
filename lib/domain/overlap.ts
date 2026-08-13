/**
 * Overlap detection — PRD §9.7.
 *
 * Derived on read from active members and current availability; OVL-001 forbids
 * storing match records. The sweep is O(I log I) over interval boundaries.
 */

import {
  MAX_RANKED_OVERLAPS,
  MIN_OVERLAP_MINUTES,
  NEAR_MATCH_MIN_MEMBERS,
  NEAR_MATCH_RATIO,
  type Interval,
  type OverlapSlot,
} from "./types";

export type MemberInterval = Interval & { userId: string };

/**
 * AVL-007 / OVL-002: merge one member's overlapping *or adjacent* intervals so
 * a member is counted at most once inside any segment, and 8–10 + 10–12 persist
 * as a single 8–12 interval.
 */
export function mergeIntervals(intervals: Interval[]): Interval[] {
  if (intervals.length === 0) return [];
  const sorted = [...intervals].sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
  const merged: Interval[] = [{ ...sorted[0] }];

  for (let i = 1; i < sorted.length; i += 1) {
    const current = sorted[i];
    const last = merged[merged.length - 1];
    // `<=` merges touching intervals, not just overlapping ones.
    if (current.startAt.getTime() <= last.endAt.getTime()) {
      if (current.endAt.getTime() > last.endAt.getTime()) last.endAt = new Date(current.endAt);
    } else {
      merged.push({ ...current });
    }
  }
  return merged;
}

/** Step 1: clamp to the requested range and drop anything already past. */
function clampToRange(intervals: MemberInterval[], rangeStart: Date, rangeEnd: Date): MemberInterval[] {
  const out: MemberInterval[] = [];
  for (const it of intervals) {
    const startAt = it.startAt < rangeStart ? rangeStart : it.startAt;
    const endAt = it.endAt > rangeEnd ? rangeEnd : it.endAt;
    // AVL-008: past intervals are omitted from overlap suggestions.
    if (startAt.getTime() < endAt.getTime()) out.push({ userId: it.userId, startAt, endAt });
  }
  return out;
}

export function computeOverlaps({
  intervals,
  activeMemberIds,
  rangeStart,
  rangeEnd,
  now = new Date(),
}: {
  intervals: MemberInterval[];
  activeMemberIds: string[];
  rangeStart: Date;
  rangeEnd: Date;
  now?: Date;
}): OverlapSlot[] {
  const totalActiveMembers = activeMemberIds.length;
  if (totalActiveMembers === 0) return [];

  const activeSet = new Set(activeMemberIds);
  // GRP-008: a removed member's availability leaves the active calculation.
  const relevant = intervals.filter((i) => activeSet.has(i.userId));

  const effectiveStart = rangeStart.getTime() > now.getTime() ? rangeStart : now;
  const clamped = clampToRange(relevant, effectiveStart, rangeEnd);
  if (clamped.length === 0) return [];

  // Step 2: merge per member.
  const byMember = new Map<string, Interval[]>();
  for (const it of clamped) {
    const list = byMember.get(it.userId) ?? [];
    list.push({ startAt: it.startAt, endAt: it.endAt });
    byMember.set(it.userId, list);
  }

  // Step 3: boundary events from every merged interval.
  type Boundary = { at: number; delta: number; userId: string };
  const boundaries: Boundary[] = [];
  for (const [userId, list] of byMember) {
    for (const iv of mergeIntervals(list)) {
      boundaries.push({ at: iv.startAt.getTime(), delta: 1, userId });
      boundaries.push({ at: iv.endAt.getTime(), delta: -1, userId });
    }
  }
  // Ends before starts at the same instant: touching intervals must not create
  // a phantom segment where the leaving and arriving member both count.
  boundaries.sort((a, b) => a.at - b.at || a.delta - b.delta);

  // Steps 4–5: sweep, emitting a segment per gap with its member set.
  type Segment = { start: number; end: number; members: Set<string> };
  const segments: Segment[] = [];
  const activeNow = new Set<string>();
  let cursor = boundaries[0].at;

  for (const b of boundaries) {
    if (b.at > cursor && activeNow.size > 0) {
      segments.push({ start: cursor, end: b.at, members: new Set(activeNow) });
    }
    if (b.delta === 1) activeNow.add(b.userId);
    else activeNow.delete(b.userId);
    cursor = b.at;
  }

  // Step 6: merge adjacent segments with an identical member set.
  const collapsed: Segment[] = [];
  for (const seg of segments) {
    const last = collapsed[collapsed.length - 1];
    if (last && last.end === seg.start && sameMembers(last.members, seg.members)) {
      last.end = seg.end;
    } else {
      collapsed.push(seg);
    }
  }

  // Steps 7–8: drop short segments and classify.
  const nearThreshold = Math.max(
    NEAR_MATCH_MIN_MEMBERS,
    Math.ceil(totalActiveMembers * NEAR_MATCH_RATIO),
  );

  const slots: OverlapSlot[] = [];
  for (const seg of collapsed) {
    const durationMinutes = Math.round((seg.end - seg.start) / 60000);
    if (durationMinutes < MIN_OVERLAP_MINUTES) continue;

    const availableCount = seg.members.size;
    const isFullMatch = availableCount === totalActiveMembers;
    // OVL-007: in a two-person group only two-of-two is promoted, so the near
    // threshold (min 3 members) naturally excludes any partial pair.
    const isNearMatch = !isFullMatch && availableCount >= nearThreshold;
    if (!isFullMatch && !isNearMatch) continue;

    slots.push({
      startAt: new Date(seg.start),
      endAt: new Date(seg.end),
      memberIds: [...seg.members],
      availableCount,
      totalActiveMembers,
      isFullMatch,
      isNearMatch,
      durationMinutes,
    });
  }

  // Step 9: rank by full-match, then count, then duration, then earliest start.
  slots.sort(
    (a, b) =>
      Number(b.isFullMatch) - Number(a.isFullMatch) ||
      b.availableCount - a.availableCount ||
      b.durationMinutes - a.durationMinutes ||
      a.startAt.getTime() - b.startAt.getTime(),
  );

  // Step 10: OVL-005 caps the display at three.
  return slots.slice(0, MAX_RANKED_OVERLAPS);
}

function sameMembers(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false;
  for (const id of a) if (!b.has(id)) return false;
  return true;
}

/**
 * How many active members are free for an arbitrary window — PLN-010 shows the
 * exact count when a round is opened over a manually chosen time.
 */
export function countAvailableInWindow({
  intervals,
  activeMemberIds,
  windowStart,
  windowEnd,
}: {
  intervals: MemberInterval[];
  activeMemberIds: string[];
  windowStart: Date;
  windowEnd: Date;
}): { availableCount: number; memberIds: string[] } {
  const activeSet = new Set(activeMemberIds);
  const covering = new Set<string>();
  for (const it of intervals) {
    if (!activeSet.has(it.userId)) continue;
    if (it.startAt <= windowStart && it.endAt >= windowEnd) covering.add(it.userId);
  }
  return { availableCount: covering.size, memberIds: [...covering] };
}

/**
 * OVL-010: a stable key per normalized slot so a threshold notification fires
 * only the first time a slot becomes full or crosses the near threshold.
 */
export function overlapDedupeKey(groupId: string, slot: OverlapSlot): string {
  const kind = slot.isFullMatch ? "full" : "near";
  return `overlap:${groupId}:${slot.startAt.toISOString()}:${slot.endAt.toISOString()}:${kind}`;
}
