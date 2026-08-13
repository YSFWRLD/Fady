import { notFound } from "next/navigation";
import { Shell } from "@/components/shell";
import { GroupSettingsPanel } from "./group-settings-panel";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getGroupMembers } from "@/lib/data/queries";

export const dynamic = "force-dynamic";

/** §7.2 role matrix — the panel only renders actions the viewer may perform. */
export default async function GroupSettingsPage({ params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await params;
  const profile = await requireProfile(`/groups/${groupId}/settings`);
  const supabase = await createClient();

  const [{ data: group }, members, { data: invite }] = await Promise.all([
    supabase.from("groups").select("id, name").eq("id", groupId).maybeSingle(),
    getGroupMembers(groupId),
    supabase
      .from("group_invites")
      .select("id, expires_at")
      .eq("group_id", groupId)
      .is("revoked_at", null)
      .maybeSingle(),
  ]);
  if (!group) notFound();

  const me = members.find((m) => m.userId === profile.id);
  if (!me) notFound();

  return (
    <Shell title="إعدادات القروب" back={`/groups/${groupId}`}>
      <GroupSettingsPanel
        groupId={groupId}
        groupName={group.name}
        myUserId={profile.id}
        myRole={me.role}
        hasActiveInvite={Boolean(invite)}
        inviteExpiresAt={invite?.expires_at ?? null}
        members={members.map((m) => ({
          userId: m.userId,
          displayName: m.displayName,
          username: m.username,
          role: m.role,
          color: m.color,
        }))}
      />
    </Shell>
  );
}
