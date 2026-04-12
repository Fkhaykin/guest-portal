import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PropertyPage } from "./property-page";

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
    title: `${property.name} | Summit Lakeside Rentals`,
    description: property.description || `Book your stay at ${property.name} in the Pocono Mountains.`,
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
    <PropertyPage
      property={property}
      checkIn={query.check_in}
      checkOut={query.check_out}
      guests={query.guests}
    />
  );
}
