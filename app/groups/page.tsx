import { Shell } from "@/components/shell";
import { LinkButton } from "@/components/ui/button";
import { Badge, Card, EmptyState } from "@/components/ui/card";
import { Avatar } from "@/components/ui/identity";
import { toArabicDigits } from "@/lib/domain/format";
import { getMyGroups } from "@/lib/data/queries";

export const dynamic = "force-dynamic";

export default async function GroupsPage() {
  const groups = await getMyGroups();

  return (
    <Shell title="القروبات" lede="كل القروبات اللي أنت فيها.">
      <div style={{ display: "flex" }}>
        <LinkButton href="/groups/new" icon={<i className="ph-bold ph-plus" aria-hidden="true" />}>
          سو قروب
        </LinkButton>
      </div>

      {groups.length === 0 ? (
        <EmptyState
          icon={<i className="ph-bold ph-users-three" aria-hidden="true" />}
          title="سو أول قروب وخلّ التخطيط أسهل"
          body="بعدها شارك الرابط مع الشلة وابدؤوا تحطون أوقاتكم."
          action={<LinkButton href="/groups/new">سو قروب</LinkButton>}
        />
      ) : (
        <div style={{ display: "grid", gap: "var(--space-3)" }}>
          {groups.map((g) => (
            <Card key={g.id} variant="flat" href={`/groups/${g.id}`}>
              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-4)" }}>
                <Avatar name={g.name} memberColor={g.color} size="lg" />
                <div style={{ display: "grid", gap: 2, flex: 1, minWidth: 0 }}>
                  <span dir="auto" style={{ font: "var(--title-md)", color: "var(--text-strong)" }}>
                    {g.name}
                  </span>
                  <span style={{ font: "var(--body-sm)", color: "var(--text-muted)" }}>
                    {toArabicDigits(g.memberCount)} أعضاء
                  </span>
                </div>
                {g.role === "owner" ? <Badge tone="plum">مالك</Badge> : g.role === "admin" ? <Badge>أدمن</Badge> : null}
              </div>
            </Card>
          ))}
        </div>
      )}
    </Shell>
  );
}
