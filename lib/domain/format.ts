/**
 * Arabic-first presentation helpers (§8.6).
 *
 * Every persisted timestamp is UTC (BR-002); everything here renders it in Saudi
 * time — IANA `Asia/Riyadh` — with Arabic-Indic digits, Arabic day names, a
 * 12-hour clock, and ص/م — never English AM/PM. Gregorian only; no Hijri.
 */

import { GROUP_TIMEZONE } from "./types";

const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";

export function toArabicDigits(value: number | string): string {
  return String(value)
    .split("")
    .map((ch) => {
      const d = "0123456789".indexOf(ch);
      return d === -1 ? ch : ARABIC_DIGITS[d];
    })
    .join("");
}

/**
 * Saudi Arabia has never observed DST, so a fixed +03:00 offset is exact for
 * `Asia/Riyadh`. Keeping it as a constant lets us do calendar-day arithmetic
 * without pulling in a timezone database.
 */
const RIYADH_OFFSET_MS = 3 * 60 * 60 * 1000;

/** The wall-clock parts of `date` as seen in Riyadh. */
export function riyadhParts(date: Date) {
  const shifted = new Date(date.getTime() + RIYADH_OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
    weekday: shifted.getUTCDay(), // 0 = Sunday, matching BR-003
  };
}

/** Midnight Saudi time, as a UTC instant, for the calendar day containing `date`. */
export function riyadhStartOfDay(date: Date): Date {
  const p = riyadhParts(date);
  return new Date(Date.UTC(p.year, p.month - 1, p.day) - RIYADH_OFFSET_MS);
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

/** A Riyadh wall-clock time on a given Riyadh calendar day, as a UTC instant. */
export function riyadhDateTime(dayStart: Date, hour: number, minute = 0): Date {
  return new Date(riyadhStartOfDay(dayStart).getTime() + (hour * 60 + minute) * 60 * 1000);
}

/** `2026-08-13` in Riyadh — the stable key used for grouping by calendar day. */
export function riyadhDateKey(date: Date): string {
  const p = riyadhParts(date);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

export const ARABIC_WEEKDAYS = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
export const ARABIC_MONTHS = [
  "يناير",
  "فبراير",
  "مارس",
  "أبريل",
  "مايو",
  "يونيو",
  "يوليو",
  "أغسطس",
  "سبتمبر",
  "أكتوبر",
  "نوفمبر",
  "ديسمبر",
];

export function weekdayName(date: Date): string {
  return ARABIC_WEEKDAYS[riyadhParts(date).weekday];
}

/** BR-003: Friday and Saturday carry weekend emphasis. */
export function isWeekend(date: Date): boolean {
  const wd = riyadhParts(date).weekday;
  return wd === 5 || wd === 6;
}

/** BR-004: 12-hour clock with ص/م, Arabic-Indic digits, minutes only when needed. */
export function formatTime(date: Date): string {
  const { hour, minute } = riyadhParts(date);
  const suffix = hour >= 12 ? "م" : "ص";
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  const hh = toArabicDigits(h12);
  return minute === 0 ? `${hh} ${suffix}` : `${hh}:${toArabicDigits(String(minute).padStart(2, "0"))} ${suffix}`;
}

/** "الخميس ٢٨" — the compact day label used across cards and calendars. */
export function formatDayShort(date: Date): string {
  const p = riyadhParts(date);
  return `${ARABIC_WEEKDAYS[p.weekday]} ${toArabicDigits(p.day)}`;
}

export function formatDayLong(date: Date): string {
  const p = riyadhParts(date);
  return `${ARABIC_WEEKDAYS[p.weekday]} ${toArabicDigits(p.day)} ${ARABIC_MONTHS[p.month - 1]}`;
}

/**
 * AVL-005: an interval crossing midnight renders across both calendar dates —
 * "الخميس ١٠ م - ١٢ ص" reads as one entry, not two.
 */
export function formatRange(startAt: Date, endAt: Date): string {
  const sameDay = riyadhDateKey(startAt) === riyadhDateKey(endAt);
  const start = `${formatDayShort(startAt)} ${formatTime(startAt)}`;
  return sameDay ? `${start} - ${formatTime(endAt)}` : `${start} - ${formatTime(endAt)} (${formatDayShort(endAt)})`;
}

/** Duration in Arabic, e.g. "ساعتين ونص". */
export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  const hourPart =
    hours === 0 ? "" : hours === 1 ? "ساعة" : hours === 2 ? "ساعتين" : `${toArabicDigits(hours)} ساعات`;
  if (rest === 0) return hourPart || `${toArabicDigits(minutes)} دقيقة`;
  if (rest === 30) return hourPart ? `${hourPart} ونص` : "نص ساعة";
  return hourPart ? `${hourPart} و${toArabicDigits(rest)} دقيقة` : `${toArabicDigits(rest)} دقيقة`;
}

/** Relative time for the notification inbox — "قبل ساعتين". */
export function formatRelative(date: Date, now = new Date()): string {
  const diffMinutes = Math.round((now.getTime() - date.getTime()) / 60000);
  if (diffMinutes < 1) return "الحين";
  if (diffMinutes < 60) return `قبل ${toArabicDigits(diffMinutes)} دقيقة`;
  const hours = Math.round(diffMinutes / 60);
  if (hours < 24) return hours === 1 ? "قبل ساعة" : hours === 2 ? "قبل ساعتين" : `قبل ${toArabicDigits(hours)} ساعات`;
  const days = Math.round(hours / 24);
  if (days === 1) return "أمس";
  if (days < 30) return `قبل ${toArabicDigits(days)} أيام`;
  return formatDayLong(date);
}

/**
 * §8.6: when the device timezone is not Saudi time, the UI shows a
 * "بتوقيت السعودية" hint alongside the time. Server-rendered output always
 * assumes Saudi time. (`Asia/Riyadh` is the IANA identifier for it — the
 * machine name stays, only the user-facing copy says السعودية.)
 */
export function deviceIsSaudiTime(): boolean {
  if (typeof Intl === "undefined") return true;
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone === GROUP_TIMEZONE;
  } catch {
    return true;
  }
}
