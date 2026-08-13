import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth";
import { FriendInvitePanel } from "./friend-invite-panel";

/**
 * `/invite/[username]` — §4.4. Signed out, the page shows generic copy and
 * preserves the route through authentication. Only after authentication is the
 * intended profile resolved and shown.
 */
export default async function FriendInvitePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const normalized = username.toLowerCase();
  const valid = /^[a-z0-9_]{3,20}$/.test(normalized);
  const user = await getUser();

  if (!user || !valid) {
    return <FriendInvitePanel username={valid ? normalized : null} target={null} signedIn={Boolean(user)} />;
  }

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_path")
    .eq("username", normalized)
    .maybeSingle();

  // FRN-008: a self-invite has nothing to add.
  const isSelf = profile?.id === user.id;

  return (
    <FriendInvitePanel
      username={normalized}
      signedIn
      isSelf={isSelf}
      target={
        profile && !isSelf
          ? { id: profile.id, username: profile.username, displayName: profile.display_name }
          : null
      }
    />
  );
}
