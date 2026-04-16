import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { ServiceCard } from "@/components/guest/service-card";

export default async function ServicesPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: property } = await supabase
    .from("property")
    .select("id")
    .eq("slug", slug)
    .single();

  if (!property) notFound();

  const { data: services } = await supabase
    .from("service")
    .select("*")
    .eq("property_id", property.id)
    .eq("is_active", true)
    .order("sort_order");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Services</h2>
        <p className="text-muted-foreground">
          Enhance your stay with additional services
        </p>
      </div>

      {services && services.length > 0 ? (
        <div className="grid gap-4">
          {services.map((service) => (
            <ServiceCard key={service.id} service={service} propertySlug={slug} />
          ))}
        </div>
      ) : (
        <p className="text-muted-foreground">No services available.</p>
      )}
    </div>
  );
}
