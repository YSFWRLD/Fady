"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Section } from "@/components/app-shell";
import { ShareButton } from "@/components/share-button";
import { Button } from "@/components/ui/button";
import { Banner, Card, EmptyState } from "@/components/ui/card";
import { Input } from "@/components/ui/form";
import { Avatar } from "@/components/ui/identity";
import { removeFriend, respondFriendRequest, sendFriendRequest } from "@/lib/actions/friends";
import { searchUsers } from "@/lib/actions/profile";
import { errorMessage } from "@/lib/domain/errors";
import type { PublicProfile } from "@/lib/domain/types";

type FriendRow = {
  friendshipId: string;
  userId: string;
  displayName: string;
  username: string;
  direction: "incoming" | "outgoing" | "friend";
};

export function FriendsPanel({ friends, myInviteUrl }: { friends: FriendRow[]; myInviteUrl: string }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PublicProfile[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const known = new Set(friends.map((f) => f.userId));
  const incoming = friends.filter((f) => f.direction === "incoming");
  const outgoing = friends.filter((f) => f.direction === "outgoing");
  const accepted = friends.filter((f) => f.direction === "friend");

  function search() {
    setError(null);
    startTransition(async () => {
      const result = await searchUsers(query);
      if (!result.ok) {
        setError(errorMessage(result.error));
        return;
      }
      setResults(result.data);
    });
  }

  function add(userId: string) {
    setError(null);
    startTransition(async () => {
      const result = await sendFriendRequest(userId);
      if (!result.ok) {
        setError(errorMessage(result.error));
        return;
      }
      setResults(null);
      setQuery("");
      router.refresh();
    });
  }

  function respond(friendshipId: string, accept: boolean) {
    setError(null);
    startTransition(async () => {
      const result = await respondFriendRequest(friendshipId, accept);
      if (!result.ok) setError(errorMessage(result.error));
      else router.refresh();
    });
  }

  function drop(friendshipId: string) {
    setError(null);
    startTransition(async () => {
      const result = await removeFriend(friendshipId);
      if (!result.ok) setError(errorMessage(result.error));
      else router.refresh();
    });
  }

  return (
    <div style={{ display: "grid", gap: "var(--space-6)" }}>
      {error ? <Banner tone="error">{error}</Banner> : null}

      <Card variant="flat">
        <div style={{ display: "grid", gap: "var(--space-3)" }}>
          <Input
            label="دوّر باليوزر"
            value={query}
            onChange={setQuery}
            dir="ltr"
            prefix="@"
            maxLength={20}
            hint="حرفين على الأقل"
          />
          <Button onClick={search} loading={pending} disabled={query.trim().length < 2}>
            دوّر
          </Button>

          {results?.length === 0 ? (
            <span style={{ font: "var(--body-md)", color: "var(--text-muted)" }}>ما لقينا أحد بهذا اليوزر.</span>
          ) : null}

          {results?.map((r) => (
            <div key={r.id} style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
              <Avatar name={r.display_name} size="sm" ring={false} />
              <div style={{ display: "grid", gap: 0, flex: 1, minWidth: 0 }}>
                <span style={{ font: "var(--label-md)", fontWeight: 700, color: "var(--text-strong)" }}>
                  {r.display_name}
                </span>
                <span style={{ font: "var(--body-sm)", color: "var(--text-muted)", direction: "ltr" }}>
                  @{r.username}
                </span>
              </div>
              <Button size="sm" tone="quiet" disabled={known.has(r.id)} onClick={() => add(r.id)}>
                {known.has(r.id) ? "مضاف" : "أضف صديق"}
              </Button>
            </div>
          ))}
        </div>
      </Card>

      <Card variant="flat" tone="quiet">
        <div style={{ display: "grid", gap: "var(--space-3)" }}>
          <span style={{ font: "var(--label-md)", fontWeight: 700, color: "var(--text-strong)" }}>رابطك</span>
          <span style={{ font: "var(--mono-sm)", color: "var(--text-muted)", direction: "ltr", wordBreak: "break-all" }}>
            {myInviteUrl}
          </span>
          <ShareButton url={myInviteUrl} text="ضفني في فاضي؟" label="شارك رابطي" />
        </div>
      </Card>

      {incoming.length > 0 ? (
        <Section title="طلبات جاتك">
          <div style={{ display: "grid", gap: "var(--space-3)" }}>
            {incoming.map((f) => (
              <Card key={f.friendshipId} variant="flat">
                <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", flexWrap: "wrap" }}>
                  <Avatar name={f.displayName} size="sm" ring={false} />
                  <span style={{ font: "var(--label-md)", color: "var(--text-strong)", flex: 1 }}>{f.displayName}</span>
                  <Button size="sm" onClick={() => respond(f.friendshipId, true)}>
                    اقبل
                  </Button>
                  <Button size="sm" tone="quiet" onClick={() => respond(f.friendshipId, false)}>
                    ارفض
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </Section>
      ) : null}

      {outgoing.length > 0 ? (
        <Section title="طلبات أرسلتها">
          <div style={{ display: "grid", gap: "var(--space-3)" }}>
            {outgoing.map((f) => (
              <Card key={f.friendshipId} variant="flat" tone="quiet">
                <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
                  <Avatar name={f.displayName} size="sm" ring={false} />
                  <span style={{ font: "var(--label-md)", color: "var(--text-strong)", flex: 1 }}>{f.displayName}</span>
                  <Button size="sm" tone="quiet" onClick={() => drop(f.friendshipId)}>
                    ألغِ
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </Section>
      ) : null}

      <Section title="أصدقائي">
        {accepted.length === 0 ? (
          <EmptyState icon={<i className="ph-bold ph-users" aria-hidden="true" />} title="دوّر أصحابك باليوزر" />
        ) : (
          <div style={{ display: "grid", gap: "var(--space-3)" }}>
            {accepted.map((f) => (
              <Card key={f.friendshipId} variant="flat">
                <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
                  <Avatar name={f.displayName} size="sm" ring={false} />
                  <div style={{ display: "grid", gap: 0, flex: 1, minWidth: 0 }}>
                    <span style={{ font: "var(--label-md)", fontWeight: 700, color: "var(--text-strong)" }}>
                      {f.displayName}
                    </span>
                    <span style={{ font: "var(--body-sm)", color: "var(--text-muted)", direction: "ltr" }}>
                      @{f.username}
                    </span>
                  </div>
                  <Button size="sm" tone="quiet" onClick={() => drop(f.friendshipId)}>
                    احذف
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}
