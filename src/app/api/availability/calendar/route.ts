import { NextResponse } from "next/server";
import { getAvailability } from "@/lib/lodgify/client";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const propertyId = searchParams.get("property_id");
  const start = searchParams.get("start");
  const end = searchParams.get("end");

  if (!propertyId || !start || !end) {
    return NextResponse.json(
      { error: "property_id, start, and end are required" },
      { status: 400 }
    );
  }

  try {
    const periods = await getAvailability(parseInt(propertyId, 10), start, end);
    return NextResponse.json({ periods });
  } catch {
    return NextResponse.json({ periods: [] });
  }
}
