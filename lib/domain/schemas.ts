/**
 * Shared Zod schemas — §9.1: the same schema validates client and server input;
 * the database remains the final constraint boundary.
 */

import { z } from "zod";
import { PLAN_CATEGORY_IDS, PLANNING_HORIZON_DAYS } from "./types";

/** PRO-002: lowercase, Latin letters/numbers/underscore, 3–20 characters. */
export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9_]{3,20}$/, "اسم المستخدم لازم يكون ٣-٢٠ حرف إنجليزي أو رقم أو _");

/** PRO-001: 1–50 characters after trim. */
export const displayNameSchema = z.string().trim().min(1, "اكتب اسمك").max(50, "الاسم طويل");

export const emailSchema = z.string().trim().toLowerCase().email("الإيميل غير صحيح");

/** §9.10 relies on Supabase Auth's own policy; this is the client-side floor. */
export const passwordSchema = z.string().min(8, "كلمة السر لازم ٨ حروف على الأقل").max(72);

export const completeProfileSchema = z.object({
  displayName: displayNameSchema,
  username: usernameSchema,
  avatarPath: z.string().max(300).nullable().optional(),
});

export const signUpSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  next: z.string().max(512).optional(),
});

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "اكتب كلمة السر"),
  next: z.string().max(512).optional(),
});

export const searchUsersSchema = z.object({
  query: z.string().trim().min(2, "اكتب حرفين على الأقل").max(20),
  cursor: z.string().uuid().optional(),
});

export const uuidSchema = z.string().uuid();

/** GRP-001: 1–40 characters after trim. */
export const groupNameSchema = z.string().trim().min(1, "سمِّ القروب").max(40, "الاسم طويل");

export const createGroupSchema = z.object({
  name: groupNameSchema,
  imagePath: z.string().max(300).nullable().optional(),
});

export const updateGroupSchema = z.object({
  groupId: uuidSchema,
  name: groupNameSchema.optional(),
  imagePath: z.string().max(300).nullable().optional(),
});

export const groupRoleSchema = z.enum(["owner", "admin", "member"]);

export const changeMemberRoleSchema = z.object({
  groupId: uuidSchema,
  userId: uuidSchema,
  role: groupRoleSchema,
});

/**
 * AVL-004/AVL-006: intervals arrive as exact UTC instants and must sit inside
 * the 28-day horizon. Ordering and the horizon are re-checked in the RPC.
 */
export const intervalSchema = z
  .object({
    startAt: z.string().datetime({ offset: true }),
    endAt: z.string().datetime({ offset: true }),
  })
  .refine((v) => new Date(v.endAt) > new Date(v.startAt), {
    message: "وقت النهاية لازم بعد البداية",
    path: ["endAt"],
  });

export const replaceAvailabilitySchema = z.object({
  groupId: uuidSchema,
  // A whole editor screen is saved at once, so the horizon caps the payload.
  intervals: z.array(intervalSchema).max(PLANNING_HORIZON_DAYS * 6),
  rangeStart: z.string().datetime({ offset: true }),
  rangeEnd: z.string().datetime({ offset: true }),
});

export const planCategorySchema = z.enum(PLAN_CATEGORY_IDS as [string, ...string[]]);

/** PLN-009: https only, never fetched server-side (no SSRF, no previews). */
export const externalUrlSchema = z
  .string()
  .trim()
  .max(2048)
  .url("الرابط غير صحيح")
  .refine((v) => v.startsWith("https://"), { message: "الرابط لازم يبدأ بـ https" });

export const suggestionFieldsSchema = z.object({
  category: planCategorySchema,
  title: z.string().trim().min(1, "اكتب عنوان").max(80, "العنوان طويل"),
  description: z.string().trim().max(500).nullable().optional(),
  proposedStartAt: z.string().datetime({ offset: true }),
  proposedEndAt: z.string().datetime({ offset: true }),
  location: z.string().trim().max(120).nullable().optional(),
  externalUrl: externalUrlSchema.nullable().optional(),
});

/** PLN-001/PLN-004: a round opens together with its first valid suggestion. */
export const openPlanningRoundSchema = z.object({
  groupId: uuidSchema,
  windowStartAt: z.string().datetime({ offset: true }),
  windowEndAt: z.string().datetime({ offset: true }),
  suggestion: suggestionFieldsSchema,
});

export const addSuggestionSchema = suggestionFieldsSchema.extend({ roundId: uuidSchema });

export const setVoteSchema = z.object({
  suggestionId: uuidSchema,
  selected: z.boolean(),
});

export const closeRoundSchema = z.object({
  roundId: uuidSchema,
  winningSuggestionId: uuidSchema,
});

export const attendanceSchema = z.object({
  planId: uuidSchema,
  status: z.enum(["going", "not_going"]),
});

export const cancelPlanSchema = z.object({
  planId: uuidSchema,
  reason: z.string().trim().max(250).nullable().optional(),
});

/** §9.4: JPEG, PNG, and WebP only, 5 MB maximum. */
export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export const imageUploadSchema = z.object({
  type: z.enum(ALLOWED_IMAGE_TYPES),
  size: z.number().int().positive().max(MAX_IMAGE_BYTES, "الصورة أكبر من ٥ ميجا"),
});

/** First Zod issue as a `{ message, field }` pair for §8.4 field-level errors. */
export function firstIssue(error: z.ZodError): { message: string; field?: string } {
  const issue = error.issues[0];
  return { message: issue?.message ?? "فيه شي ناقص", field: issue?.path?.[0]?.toString() };
}
