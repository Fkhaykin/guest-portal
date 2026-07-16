import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { KioskClient } from "./kiosk-client";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return {
    title: "Guest Kiosk",
    robots: { index: false, follow: false },
    // Overrides the root layout's /manifest.json so an "Add to Home screen"
    // install pins to THIS kiosk's deep URL and launches fullscreen.
    manifest: `/kiosk/${token}/manifest.webmanifest`,
  };
}

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
