import { redirect } from "next/navigation";
import { validateCleanerSession } from "@/lib/cleaner/auth";
import { getSessionToken } from "@/lib/cleaner/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { CleanerSidebar } from "@/components/cleaner/sidebar";

export default async function CleanerProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const token = await getSessionToken();

  if (!token) {
    redirect("/cleaner/login");
  }

  const cleaner = await validateCleanerSession(token);

  if (!cleaner) {
    redirect("/cleaner/login");
  }

  // Get task stats for sidebar
  const supabase = createAdminClient();
  const { data: assignments } = await supabase
    .from("cleaner_property")
    .select("property_id")
    .eq("cleaner_id", cleaner.id);

  const propertyIds = (assignments || []).map((a) => a.property_id);

  let totalTasks = 0;
  let completedTasks = 0;

  if (propertyIds.length > 0) {
    const today = new Date().toISOString().split("T")[0];
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];

    const { data: regs } = await supabase
      .from("registration")
      .select("id")
      .in("property_id", propertyIds)
      .in("status", ["active", "completed"])
      .gte("check_out_date", twoDaysAgo);

    const regIds = (regs || []).map((r) => r.id);
    totalTasks = regIds.length;

    if (regIds.length > 0) {
      const { data: statuses } = await supabase
        .from("cleaning_status")
        .select("registration_id")
        .in("registration_id", regIds)
        .eq("is_cleaned", true);
      completedTasks = (statuses || []).length;
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <CleanerSidebar
        cleanerName={cleaner.name}
        totalTasks={totalTasks}
        completedTasks={completedTasks}
      />
      <main className="md:ml-56 max-w-4xl mx-auto px-4 py-6 pt-16 md:pt-6 pb-20 md:pb-6">
        {children}
      </main>
    </div>
  );
}
