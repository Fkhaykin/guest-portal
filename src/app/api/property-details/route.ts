import { NextResponse } from "next/server";
import { getPropertyDetails } from "@/lib/property-details";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get("slug");

  if (!slug) {
    return NextResponse.json({ error: "slug is required" }, { status: 400 });
  }

  const details = await getPropertyDetails(slug);
  if (!details) {
    return NextResponse.json({ error: "Property not found" }, { status: 404 });
  }

  return NextResponse.json(details);
}
