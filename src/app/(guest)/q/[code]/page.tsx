import { redirect, notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function QRResolverPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const supabase = createAdminClient();

  // Look up the QR code
  const { data: qrCode } = await supabase
    .from("qr_code")
    .select("*, property:property_id(slug)")
    .eq("code", code)
    .eq("is_active", true)
    .single();

  if (!qrCode || !qrCode.property) {
    notFound();
  }

  // Increment scan count (fire and forget)
  supabase
    .from("qr_code")
    .update({ scan_count: qrCode.scan_count + 1 })
    .eq("id", qrCode.id)
    .then();

  const slug = (qrCode.property as { slug: string }).slug;
  const base = `/p/${slug}`;

  // Resolve target
  switch (qrCode.target_type) {
    case "video":
      redirect(`${base}/videos/${qrCode.target_id}`);
    case "home":
      redirect(base);
    case "services":
      redirect(`${base}/services`);
    case "faq":
      redirect(`${base}/faq`);
    case "registration":
      redirect(`${base}/register`);
    case "custom_url":
      if (qrCode.custom_url) {
        redirect(qrCode.custom_url);
      }
      redirect(base);
    default:
      redirect(base);
  }
}
