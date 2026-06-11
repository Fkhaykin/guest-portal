import { redirect } from "next/navigation";

export default async function LegacyCleanersRedirect({
  params,
}: {
  params: Promise<{ path?: string[] }>;
}) {
  const { path } = await params;
  if (!path || path.length === 0) redirect("/admin/settings?tab=cleaners");
  redirect(`/admin/settings/cleaners/${path.join("/")}`);
}
