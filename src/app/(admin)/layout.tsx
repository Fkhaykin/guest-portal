import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { AdminSidebar } from "@/components/admin/sidebar";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login?redirect=/admin");
  }

  // Verify the user is a host
  const { data: host } = await supabase
    .from("host")
    .select("id, full_name, email")
    .eq("auth_user_id", user.id)
    .single();

  if (!host) {
    redirect("/");
  }

  return (
    <div className="flex min-h-full">
      <AdminSidebar hostName={host.full_name} hostEmail={host.email} />
      <main className="flex-1 p-6 md:p-8 overflow-auto">{children}</main>
    </div>
  );
}
