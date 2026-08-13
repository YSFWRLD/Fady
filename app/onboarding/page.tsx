import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { readInviteIntent } from "@/lib/actions/invite-intent";
import { getMyGroups } from "@/lib/data/queries";
import { OnboardingWizard } from "./onboarding-wizard";

/**
 * PRO-005 — Welcome → Profile → Friends → Group → Availability. Friends and
 * Group are skippable unless a pending invite requires them (PRO-006).
 */
export default async function OnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/sign-in");

  const [{ data: profile }, pendingInvite, groups] = await Promise.all([
    supabase.from("profiles").select("username, display_name, onboarding_completed_at").eq("id", user.id).maybeSingle(),
    readInviteIntent(),
    getMyGroups(),
  ]);

  return (
    <OnboardingWizard
      initialDisplayName={profile?.onboarding_completed_at ? (profile.display_name ?? "") : ""}
      initialUsername={profile?.onboarding_completed_at ? (profile.username ?? "") : ""}
      profileDone={Boolean(profile?.onboarding_completed_at)}
      hasPendingInvite={Boolean(pendingInvite)}
      firstGroup={groups[0] ? { id: groups[0].id, name: groups[0].name } : null}
    />
  );
}
