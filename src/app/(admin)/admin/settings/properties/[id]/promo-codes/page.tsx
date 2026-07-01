import { redirect } from "next/navigation";

// Promotions + Promo Codes were consolidated into one Promo Builder.
export default async function LegacyPromoCodesRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/admin/settings/properties/${id}/promos`);
}
