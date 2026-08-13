import { describe, expect, it } from "vitest";
import { computeOverlaps, countAvailableInWindow, mergeIntervals, type MemberInterval } from "./overlap";

const T = (iso: string) => new Date(iso);
const RANGE_START = T("2026-08-13T00:00:00Z");
const RANGE_END = T("2026-09-10T00:00:00Z");
const NOW = T("2026-08-13T00:00:00Z");

function slot(userId: string, start: string, end: string): MemberInterval {
  return { userId, startAt: T(start), endAt: T(end) };
}

const run = (intervals: MemberInterval[], memberIds: string[]) =>
  computeOverlaps({ intervals, activeMemberIds: memberIds, rangeStart: RANGE_START, rangeEnd: RANGE_END, now: NOW });

describe("mergeIntervals", () => {
  it("merges adjacent blocks into one interval (AVL-007)", () => {
    // 8–10 PM plus 10 PM–12 AM must persist as a single 8 PM–12 AM interval.
    const merged = mergeIntervals([
      { startAt: T("2026-08-13T17:00:00Z"), endAt: T("2026-08-13T19:00:00Z") },
      { startAt: T("2026-08-13T19:00:00Z"), endAt: T("2026-08-13T21:00:00Z") },
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0].startAt.toISOString()).toBe("2026-08-13T17:00:00.000Z");
    expect(merged[0].endAt.toISOString()).toBe("2026-08-13T21:00:00.000Z");
  });

  it("keeps disjoint intervals separate", () => {
    const merged = mergeIntervals([
      { startAt: T("2026-08-13T17:00:00Z"), endAt: T("2026-08-13T19:00:00Z") },
      { startAt: T("2026-08-14T17:00:00Z"), endAt: T("2026-08-14T19:00:00Z") },
    ]);
    expect(merged).toHaveLength(2);
  });
});

describe("computeOverlaps", () => {
  const members = ["u1", "u2", "u3", "u4", "u5", "u6"];

  it("promotes a full match when every active member is free", () => {
    const intervals = members.map((u) => slot(u, "2026-08-13T19:00:00Z", "2026-08-13T21:00:00Z"));
    const [top] = run(intervals, members);
    expect(top.isFullMatch).toBe(true);
    expect(top.availableCount).toBe(6);
    expect(top.durationMinutes).toBe(120);
  });

  it("classifies five of six over 90 minutes as a near match (OVL-006)", () => {
    const intervals = members
      .slice(0, 5)
      .map((u) => slot(u, "2026-08-14T19:00:00Z", "2026-08-14T20:30:00Z"));
    const [top] = run(intervals, members);
    expect(top.isFullMatch).toBe(false);
    expect(top.isNearMatch).toBe(true);
    expect(top.availableCount).toBe(5);
    expect(top.durationMinutes).toBe(90);
  });

  it("counts a member once when their own intervals overlap (OVL-002)", () => {
    const intervals = [
      ...members.map((u) => slot(u, "2026-08-13T19:00:00Z", "2026-08-13T21:00:00Z")),
      slot("u1", "2026-08-13T19:30:00Z", "2026-08-13T20:30:00Z"),
      slot("u1", "2026-08-13T19:00:00Z", "2026-08-13T21:00:00Z"),
    ];
    const [top] = run(intervals, members);
    expect(top.availableCount).toBe(6);
    expect(new Set(top.memberIds).size).toBe(6);
  });

  it("drops segments shorter than 60 minutes (OVL-003)", () => {
    const intervals = members.map((u) => slot(u, "2026-08-13T19:00:00Z", "2026-08-13T19:45:00Z"));
    expect(run(intervals, members)).toHaveLength(0);
  });

  it("ranks the longer slot first when counts tie (OVL-004)", () => {
    const intervals = [
      ...members.map((u) => slot(u, "2026-08-13T19:00:00Z", "2026-08-13T20:00:00Z")),
      ...members.map((u) => slot(u, "2026-08-14T19:00:00Z", "2026-08-14T22:00:00Z")),
    ];
    const [first, second] = run(intervals, members);
    expect(first.durationMinutes).toBe(180);
    expect(second.durationMinutes).toBe(60);
  });

  it("orders equal durations by earliest start", () => {
    const intervals = [
      ...members.map((u) => slot(u, "2026-08-15T19:00:00Z", "2026-08-15T21:00:00Z")),
      ...members.map((u) => slot(u, "2026-08-13T19:00:00Z", "2026-08-13T21:00:00Z")),
    ];
    const [first] = run(intervals, members);
    expect(first.startAt.toISOString()).toBe("2026-08-13T19:00:00.000Z");
  });

  it("returns at most three results (OVL-005)", () => {
    const intervals = [0, 1, 2, 3, 4].flatMap((d) =>
      members.map((u) => slot(u, `2026-08-1${3 + d}T19:00:00Z`, `2026-08-1${3 + d}T21:00:00Z`)),
    );
    expect(run(intervals, members)).toHaveLength(3);
  });

  it("promotes only two-of-two in a two-person group (OVL-007)", () => {
    const pair = ["a", "b"];
    const both = run(
      pair.map((u) => slot(u, "2026-08-13T19:00:00Z", "2026-08-13T21:00:00Z")),
      pair,
    );
    expect(both[0].isFullMatch).toBe(true);

    const onlyOne = run([slot("a", "2026-08-13T19:00:00Z", "2026-08-13T21:00:00Z")], pair);
    expect(onlyOne).toHaveLength(0);
  });

  it("handles an interval crossing midnight as one slot (AVL-005)", () => {
    // Thursday 10 PM – Friday 2 AM Riyadh = 19:00Z Thursday – 23:00Z Thursday.
    const intervals = members.map((u) => slot(u, "2026-08-13T19:00:00Z", "2026-08-13T23:00:00Z"));
    const [top] = run(intervals, members);
    expect(top.durationMinutes).toBe(240);
    expect(top.isFullMatch).toBe(true);
  });

  it("excludes availability from members who left the group (GRP-008)", () => {
    const intervals = [...members, "gone"].map((u) => slot(u, "2026-08-13T19:00:00Z", "2026-08-13T21:00:00Z"));
    const [top] = run(intervals, members);
    expect(top.availableCount).toBe(6);
    expect(top.memberIds).not.toContain("gone");
  });

  it("ignores intervals that already ended (AVL-008)", () => {
    const past = members.map((u) => slot(u, "2026-08-12T19:00:00Z", "2026-08-12T21:00:00Z"));
    expect(run(past, members)).toHaveLength(0);
  });

  it("does not create a phantom segment where one member replaces another", () => {
    // u1..u5 free 19–21; u6 free 21–23. At 21:00 exactly, five people are free,
    // never six.
    const intervals = [
      ...members.slice(0, 5).map((u) => slot(u, "2026-08-13T19:00:00Z", "2026-08-13T21:00:00Z")),
      slot("u6", "2026-08-13T21:00:00Z", "2026-08-13T23:00:00Z"),
    ];
    for (const s of run(intervals, members)) expect(s.isFullMatch).toBe(false);
  });
});

describe("countAvailableInWindow", () => {
  it("counts only members free for the whole window (PLN-010)", () => {
    const members = ["u1", "u2", "u3"];
    const intervals = [
      slot("u1", "2026-08-13T19:00:00Z", "2026-08-13T23:00:00Z"),
      slot("u2", "2026-08-13T19:00:00Z", "2026-08-13T20:00:00Z"), // partial
      slot("u3", "2026-08-13T18:00:00Z", "2026-08-14T01:00:00Z"),
    ];
    const result = countAvailableInWindow({
      intervals,
      activeMemberIds: members,
      windowStart: T("2026-08-13T19:00:00Z"),
      windowEnd: T("2026-08-13T21:00:00Z"),
    });
    expect(result.availableCount).toBe(2);
    expect(result.memberIds.sort()).toEqual(["u1", "u3"]);
  });
});
