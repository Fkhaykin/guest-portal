import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PropertyProvider } from "@/components/guest/property-provider";
import { GuestNav } from "@/components/guest/guest-nav";
import { PropertyHeader } from "@/components/guest/guest-header";
import { KioskChromeGate } from "@/components/kiosk/kiosk-chrome";

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
    .single();

  if (!property) {
    notFound();
  }

  return (
    <PropertyProvider property={property}>
      <div
        data-kiosk-pad
        className="flex flex-col min-h-full pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-0"
      >
        <KioskChromeGate />
        <PropertyHeader propertyName={property.name} showBack />
        <GuestNav />
        <main data-kiosk-main className="flex-1 max-w-4xl mx-auto w-full px-4 py-6">
          {children}
        </main>
      </div>
    </PropertyProvider>
  );
}
