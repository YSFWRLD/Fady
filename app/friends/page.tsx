import { Shell } from "@/components/shell";
import { FriendsPanel } from "./friends-panel";
import { requireProfile } from "@/lib/auth";
import { getFriends } from "@/lib/data/queries";

export const dynamic = "force-dynamic";

export default async function FriendsPage() {
  const [profile, friends] = await Promise.all([requireProfile("/friends"), getFriends()]);
  const origin = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");

  return (
    <Shell title="أصدقائي" lede="دوّر أصحابك باليوزر، أو شارك رابطك." back="/profile">
      <FriendsPanel friends={friends} myInviteUrl={`${origin}/invite/${profile.username}`} />
    </Shell>
  );
}
