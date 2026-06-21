import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { ShoppingBag } from "lucide-react";
import { ServiceCard } from "@/components/guest/service-card";
import { EmptyState } from "@/components/ui/empty-state";

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
        <EmptyState
          icon={ShoppingBag}
          title="No services available"
          description="There are no additional services for this property right now. Check back soon."
        />
      )}
    </div>
  );
}
