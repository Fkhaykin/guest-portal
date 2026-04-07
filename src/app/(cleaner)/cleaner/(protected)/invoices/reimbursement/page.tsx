import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { validateCleanerSession } from "@/lib/cleaner/auth";
import { getSessionToken } from "@/lib/cleaner/session";
import { ReimbursementForm } from "@/components/cleaner/reimbursement-form";

export const dynamic = "force-dynamic";

export default async function ReimbursementPage() {
  const token = await getSessionToken();
  if (!token) redirect("/cleaner/login");

  const cleaner = await validateCleanerSession(token);
  if (!cleaner) redirect("/cleaner/login");

  const supabase = createAdminClient();

  // Get assigned properties
  const { data: assignments } = await supabase
    .from("cleaner_property")
    .select("property_id")
    .eq("cleaner_id", cleaner.id);

  const propertyIds = (assignments || []).map((a) => a.property_id);

  const { data: properties } = await supabase
    .from("property")
    .select("id, name")
    .in("id", propertyIds.length > 0 ? propertyIds : ["_none_"])
    .order("name");

  return (
    <ReimbursementForm
      properties={(properties || []).map((p) => ({
        id: p.id,
        name: p.name,
      }))}
    />
  );
}
