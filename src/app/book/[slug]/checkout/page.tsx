import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CheckoutForm } from "./checkout-form";
import { CheckoutConfirmation } from "./checkout-confirmation";

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

  return {
    title: property
      ? `Checkout — ${property.name} | Summit Lakeside Rentals`
      : "Checkout | Summit Lakeside Rentals",
  };
}

export default async function CheckoutPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{
    check_in?: string;
    check_out?: string;
    guests?: string;
    pets?: string;
    success?: string;
    session_id?: string;
  }>;
}) {
  const { slug } = await params;
  const query = await searchParams;
  const supabase = await createClient();

  const { data: property } = await supabase
    .from("property")
    .select("id, name, slug, cover_image_url, lodgify_property_id, cleaning_fee_cents, pet_fee_cents")
    .eq("slug", slug)
    .eq("is_active", true)
    .single();

  if (!property) notFound();

  // Success state
  if (query.success === "true" && query.session_id) {
    return <CheckoutConfirmation sessionId={query.session_id} propertyName={property.name} slug={slug} />;
  }

  if (!query.check_in || !query.check_out) notFound();

  return (
    <CheckoutForm
      property={property}
      checkIn={query.check_in}
      checkOut={query.check_out}
      guests={parseInt(query.guests || "2", 10)}
      pets={parseInt(query.pets || "0", 10)}
    />
  );
}
