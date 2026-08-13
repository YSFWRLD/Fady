import { Shell } from "@/components/shell";
import { NewGroupForm } from "./new-group-form";

export default function NewGroupPage() {
  return (
    <Shell title="سو قروب" lede="سمِّه باسم تعرفونه، وبعدين شارك الرابط." back="/groups">
      <NewGroupForm />
    </Shell>
  );
}
