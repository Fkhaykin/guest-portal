import { createClient, getAuthenticatedUser } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { AdminSidebar } from "@/components/admin/sidebar";
import { PushPrompt } from "@/components/push-prompt";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const user = await getAuthenticatedUser(supabase);

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
    {/* h-dvh pins the shell to the viewport so pages scroll inside <main>,
        keeping the sidebar fully visible; h-full children fill the content area */}
    <div className="flex h-dvh">
      <AdminSidebar hostName={host.full_name} hostEmail={host.email} />
      <main className="flex-1 p-6 pt-16 md:p-8 overflow-auto">
        <PushPrompt
          endpoint="/api/admin/push"
          description="Get notified when guests message, book, or update a reservation."
        />
        {children}
      </main>
    </div>
  );
}
