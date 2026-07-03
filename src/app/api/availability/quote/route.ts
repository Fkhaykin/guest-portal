import { NextResponse } from "next/server";
import { getQuoteDetailed } from "@/lib/lodgify/client";

// Lodgify rejects quotes with code 666 and a human-readable message; map the
// two known phrasings to structured reasons the booking UI can act on.
function classifyQuoteFailure(message: string): {
  reason: "min_stay" | "unavailable" | "unknown";
  minStay: number | null;
  friendly: string;
} {
  const minStayMatch = message.match(/minimum stay for this rental is (\d+)/i);
  if (minStayMatch) {
    const minStay = parseInt(minStayMatch[1], 10);
    return {
      reason: "min_stay",
      minStay,
      friendly: `This home has a ${minStay}-night minimum for these dates.`,
    };
  }
  if (/already booked/i.test(message)) {
    return {
      reason: "unavailable",
      minStay: null,
      friendly: "These dates were just booked. Please choose different dates.",
    };
  }
  return {
    reason: "unknown",
    minStay: null,
    friendly: "Live pricing is unavailable right now — your total will be shown at checkout.",
  };
}

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

  const result = await getQuoteDetailed(parseInt(propertyId, 10), arrival, departure, guests);

  if (!result.ok) {
    const { reason, minStay, friendly } = classifyQuoteFailure(result.message);
    return NextResponse.json(
      { error: "quote_failed", reason, minStay, message: friendly },
      { status: 422 }
    );
  }

  return NextResponse.json({
    total: result.total,
    roomRate: result.roomRate,
    currency: result.currency,
  });
}
