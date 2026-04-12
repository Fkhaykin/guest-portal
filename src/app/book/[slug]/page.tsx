import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { BookingWidget } from "./booking-widget";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: property } = await supabase
    .from("property")
    .select("name")
    .eq("slug", slug)
    .eq("is_active", true)
    .single();

  if (!property) return { title: "Property Not Found" };

  return {
    title: `Book ${property.name} | Summit Lakeside Rentals`,
    description: `Book your stay at ${property.name} in the Pocono Mountains.`,
  };
}

export default async function BookPropertyPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ check_in?: string; check_out?: string; guests?: string }>;
}) {
  const { slug } = await params;
  const query = await searchParams;
  const supabase = await createClient();

  const { data: property } = await supabase
    .from("property")
    .select(
      "id, name, slug, address, description, cover_image_url, max_guests, lodgify_property_id"
    )
    .eq("slug", slug)
    .eq("is_active", true)
    .single();

  if (!property || !property.lodgify_property_id) {
    notFound();
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-6xl mx-auto flex items-center gap-4 px-4 sm:px-6 h-14">
          <Link
            href="/home-v2"
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
          <div className="flex-1 flex justify-center">
            <Image
              src="/logo.png"
              alt="Summit Lakeside Rentals"
              width={120}
              height={60}
              className="h-8 w-auto invert dark:invert-0"
            />
          </div>
          <div className="w-14" /> {/* Spacer to center logo */}
        </div>
      </header>

      {/* Hero */}
      {property.cover_image_url && (
        <div className="relative w-full h-48 sm:h-64">
          <img
            src={property.cover_image_url}
            alt={property.name}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/30 to-transparent" />
          <div className="absolute bottom-4 left-0 right-0 px-4 sm:px-6">
            <div className="max-w-6xl mx-auto">
              <h1 className="text-2xl sm:text-3xl font-bold">{property.name}</h1>
              {property.address && (
                <p className="text-sm text-muted-foreground mt-1">
                  {property.address}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Booking widget */}
      <div className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 py-8">
        {!property.cover_image_url && (
          <div className="mb-6">
            <h1 className="text-2xl sm:text-3xl font-bold">{property.name}</h1>
            {property.address && (
              <p className="text-sm text-muted-foreground mt-1">
                {property.address}
              </p>
            )}
          </div>
        )}

        {property.description && (
          <p className="text-muted-foreground mb-6 max-w-2xl">
            {property.description}
          </p>
        )}

        <BookingWidget
          lodgifyPropertyId={property.lodgify_property_id}
          checkIn={query.check_in}
          checkOut={query.check_out}
          guests={query.guests}
        />
      </div>

      {/* Footer */}
      <footer className="border-t py-6 text-center text-xs text-muted-foreground">
        &copy; {new Date().getFullYear()} Summit Lakeside Rentals. All rights
        reserved.
      </footer>
    </div>
  );
}
