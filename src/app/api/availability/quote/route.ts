import { NextResponse } from "next/server";
import { getQuote } from "@/lib/lodgify/client";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const propertyId = searchParams.get("property_id");
  const arrival = searchParams.get("arrival");
  const departure = searchParams.get("departure");
  const guests = parseInt(searchParams.get("guests") || "2", 10);

  if (!propertyId || !arrival || !departure) {
    return NextResponse.json(
      { error: "property_id, arrival, and departure are required" },
      { status: 400 }
    );
  }

  const quote = await getQuote(parseInt(propertyId, 10), arrival, departure, guests);

  if (!quote) {
    return NextResponse.json({ error: "Unable to fetch quote" }, { status: 502 });
  }

  return NextResponse.json(quote);
}
