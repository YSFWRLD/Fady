"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Section } from "@/components/app-shell";
import { InviteLinkCard } from "@/components/invite-link-card";
import { Button } from "@/components/ui/button";
import { Badge, Banner, Card } from "@/components/ui/card";
import { Input } from "@/components/ui/form";
import { Avatar } from "@/components/ui/identity";
import {
  changeMemberRole,
  deleteGroup,
  leaveGroup,
  removeGroupMember,
  updateGroup,
} from "@/lib/actions/groups";
import { errorMessage } from "@/lib/domain/errors";
import { formatDayLong, toArabicDigits } from "@/lib/domain/format";
import { MAX_GROUP_MEMBERS, type GroupRole } from "@/lib/domain/types";

type Member = { userId: string; displayName: string; username: string; role: GroupRole; color: number };

export function GroupSettingsPanel({
  groupId,
  groupName,
  myUserId,
  myRole,
  members,
  hasActiveInvite,
  inviteExpiresAt,
}: {
  groupId: string;
  groupName: string;
  myUserId: string;
  myRole: GroupRole;
  members: Member[];
  hasActiveInvite: boolean;
  inviteExpiresAt: string | null;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, startTransition] = useTransition();

  const isOwner = myRole === "owner";
  const isAdmin = isOwner || myRole === "admin";
  const otherMembers = members.filter((m) => m.userId !== myUserId);

  function run(fn: () => Promise<{ ok: boolean; error?: { code: string } }>, after?: () => void) {
    setError(null);
    startTransition(async () => {
      const result = (await fn()) as { ok: boolean; error?: { code: string; field?: string } };
      if (!result.ok && result.error) {
        setError(errorMessage(result.error as never));
        return;
      }
      after?.();
      router.refresh();
    });
  }

  return (
    <div style={{ display: "grid", gap: "var(--space-6)" }}>
      {error ? <Banner tone="error">{error}</Banner> : null}

      {isAdmin ? (
        <Section title="اسم القروب">
          <Card variant="flat">
            <form
              action={(formData: FormData) =>
                run(() => updateGroup({ groupId, name: String(formData.get("name") ?? "") }))
              }
              style={{ display: "grid", gap: "var(--space-3)" }}
            >
              <Input name="name" defaultValue={groupName} maxLength={40} required />
              <Button type="submit" loading={pending}>
                احفظ
              </Button>
            </form>
          </Card>
        </Section>
      ) : null}

      <Section title="رابط الدعوة">
        <div style={{ display: "grid", gap: "var(--space-2)" }}>
          <InviteLinkCard
            groupId={groupId}
            groupName={groupName}
            canManage={isAdmin}
            hasActiveInvite={hasActiveInvite}
          />
          {inviteExpiresAt ? (
            <span style={{ font: "var(--body-sm)", color: "var(--text-faint)" }}>
              الرابط الحالي ينتهي {formatDayLong(new Date(inviteExpiresAt))}
            </span>
          ) : null}
        </div>
      </Section>

      <Section title={`الأعضاء (${toArabicDigits(members.length)} من ${toArabicDigits(MAX_GROUP_MEMBERS)})`}>
        <Card variant="flat">
          <div style={{ display: "grid", gap: "var(--space-4)" }}>
            {members.map((m) => (
              <div key={m.userId} style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", flexWrap: "wrap" }}>
                <Avatar name={m.displayName} memberColor={m.color} size="sm" ring={false} />
                <div style={{ display: "grid", gap: 0, flex: 1, minWidth: 120 }}>
                  <span style={{ font: "var(--label-md)", fontWeight: 700, color: "var(--text-strong)" }}>
                    {m.displayName}
                    {m.userId === myUserId ? " (أنت)" : ""}
                  </span>
                  <span style={{ font: "var(--body-sm)", color: "var(--text-muted)", direction: "ltr" }}>
                    @{m.username}
                  </span>
                </div>

                {m.role === "owner" ? <Badge tone="plum">مالك</Badge> : m.role === "admin" ? <Badge>أدمن</Badge> : null}

                {/* GRP-005: only the owner promotes, demotes, or transfers. */}
                {isOwner && m.userId !== myUserId ? (
                  <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
                    {m.role === "member" ? (
                      <Button size="sm" tone="quiet" onClick={() => run(() => changeMemberRole({ groupId, userId: m.userId, role: "admin" }))}>
                        رقّيه أدمن
                      </Button>
                    ) : m.role === "admin" ? (
                      <Button size="sm" tone="quiet" onClick={() => run(() => changeMemberRole({ groupId, userId: m.userId, role: "member" }))}>
                        نزّله عضو
                      </Button>
                    ) : null}
                    <Button size="sm" tone="outline" onClick={() => run(() => changeMemberRole({ groupId, userId: m.userId, role: "owner" }))}>
                      انقل الملكية
                    </Button>
                  </div>
                ) : null}

                {/* GRP-004 / §7.2: an admin may not remove the owner or another admin. */}
                {isAdmin && m.userId !== myUserId && (isOwner || m.role === "member") ? (
                  <Button size="sm" tone="danger" onClick={() => run(() => removeGroupMember(groupId, m.userId))}>
                    اطرده
                  </Button>
                ) : null}
              </div>
            ))}
          </div>
        </Card>
      </Section>

      <Section title="خطر">
        <div style={{ display: "grid", gap: "var(--space-3)" }}>
          {/* GRP-007: an owner with other members transfers ownership first. */}
          {isOwner && otherMembers.length > 0 ? (
            <Banner tone="info">لازم تنقل الملكية لأحد الأعضاء قبل ما تطلع من القروب.</Banner>
          ) : (
            <Button tone="outline" block loading={pending} onClick={() => run(() => leaveGroup(groupId), () => router.push("/groups"))}>
              اطلع من القروب
            </Button>
          )}

          {isOwner ? (
            confirmDelete ? (
              <div style={{ display: "grid", gap: "var(--space-2)" }}>
                <Banner tone="error">
                  حذف القروب يلغي الخطط الجاية ويوقف روابط الدعوة. ما فيه رجعة من هنا.
                </Banner>
                <Button tone="danger" block loading={pending} onClick={() => run(() => deleteGroup(groupId), () => router.push("/groups"))}>
                  أكيد، احذف {groupName}
                </Button>
                <Button tone="quiet" block onClick={() => setConfirmDelete(false)}>
                  تراجع
                </Button>
              </div>
            ) : (
              <Button tone="danger" block onClick={() => setConfirmDelete(true)}>
                احذف القروب
              </Button>
            )
          ) : null}
        </div>
      </Section>
    </div>
  );
}
