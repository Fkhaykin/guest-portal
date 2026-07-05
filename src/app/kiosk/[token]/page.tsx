import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { KioskClient } from "./kiosk-client";

export const metadata = {
  title: "Guest Kiosk",
  robots: { index: false, follow: false },
};

export default async function KioskPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const admin = createAdminClient();
  const { data: kiosk } = await admin
    .from("kiosk")
    .select("property_id")
    .eq("token", token)
    .maybeSingle();
  if (!kiosk) notFound();

  return <KioskClient token={token} />;
}
