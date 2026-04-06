import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PropertyProvider } from "@/components/guest/property-provider";
import { GuestNav } from "@/components/guest/guest-nav";
import { PropertyHeader } from "@/components/guest/guest-header";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: property } = await supabase
    .from("property")
    .select("name, description")
    .eq("slug", slug)
    .eq("is_active", true)
    .single();

  if (!property) return { title: "Property Not Found" };

  return {
    title: `${property.name} | Guest Portal`,
    description: property.description || `Welcome to ${property.name}`,
  };
}

export default async function PropertyLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: property } = await supabase
    .from("property")
    .select("*")
    .eq("slug", slug)
    .eq("is_active", true)
    .single();

  if (!property) {
    notFound();
  }

  return (
    <PropertyProvider property={property}>
      <div className="flex flex-col min-h-full pb-16 md:pb-0">
        <PropertyHeader propertyName={property.name} />
        <GuestNav />
        <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-6">
          {children}
        </main>
      </div>
    </PropertyProvider>
  );
}
