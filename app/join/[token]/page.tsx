import { JoinPanel } from "../join-panel";
import { getUser } from "@/lib/auth";

/** `/join/[token]` — public shell that preserves the invite without leaking data. */
export default async function JoinWithTokenPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const user = await getUser();
  const valid = /^[a-f0-9]{16,64}$/.test(token);

  return <JoinPanel token={valid ? token : null} signedIn={Boolean(user)} />;
}
