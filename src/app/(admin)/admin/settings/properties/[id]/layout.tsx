import { createClient } from "@/lib/supabase/server";
import { PropertyBreadcrumbs } from "@/components/admin/property-breadcrumbs";

export default async function PropertySettingsLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: property } = await supabase
    .from("property")
    .select("name")
    .eq("id", id)
    .single();

  return (
    <div className="space-y-4">
      <PropertyBreadcrumbs
        propertyId={id}
        propertyName={property?.name ?? "Property"}
      />
      {children}
    </div>
  );
}
