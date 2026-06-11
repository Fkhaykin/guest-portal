import { redirect } from "next/navigation";

export default async function LegacyPropertiesRedirect({
  params,
}: {
  params: Promise<{ path?: string[] }>;
}) {
  const { path } = await params;
  if (!path || path.length === 0) redirect("/admin/settings?tab=properties");
  redirect(`/admin/settings/properties/${path.join("/")}`);
}
