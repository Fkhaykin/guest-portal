import { redirect } from "next/navigation";

export default function LodgifyWebhooksPage() {
  redirect("/admin/settings?tab=lodgify-webhooks");
}
