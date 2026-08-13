import { JoinPanel } from "./join-panel";
import { getUser } from "@/lib/auth";
import { readInviteIntent } from "@/lib/actions/invite-intent";

/**
 * `/join` with no token — the destination after signing up or in. The pending
 * intent is read back from the httpOnly cookie rather than a URL parameter.
 */
export default async function JoinPendingPage() {
  const [user, token] = await Promise.all([getUser(), readInviteIntent()]);
  return <JoinPanel token={token} signedIn={Boolean(user)} />;
}
