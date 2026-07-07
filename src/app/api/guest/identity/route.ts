import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyGuestToken } from "@/lib/guest-token";
import { stripe } from "@/lib/stripe/client";
import { finalizeIdentitySession } from "@/lib/identity/verify";

/**
 * Start a Stripe Identity verification for a registration.
 * Returns a client_secret the browser hands to `stripe.verifyIdentity()`.
 */
export async function POST(request: Request) {
  const { registration_id } = (await request.json()) as { registration_id?: string };
  const token = request.headers.get("x-guest-token") || "";

  if (!registration_id) {
    return NextResponse.json({ error: "registration_id is required" }, { status: 400 });
  }
  if (!verifyGuestToken(registration_id, token)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const { data: reg } = await supabase
    .from("registration")
    .select("id, guest_id, id_verification_status")
    .eq("id", registration_id)
    .single();

  if (!reg) {
    return NextResponse.json({ error: "Registration not found" }, { status: 404 });
  }
  if (reg.id_verification_status === "verified") {
    return NextResponse.json({ status: "verified" });
  }

  const session = await stripe.identity.verificationSessions.create({
    type: "document",
    metadata: { registration_id, guest_id: reg.guest_id },
    options: {
      document: {
        require_matching_selfie: true, // selfie must match the ID face
        require_live_capture: true, // block uploaded screenshots of an ID
        allowed_types: ["driving_license", "passport", "id_card"],
      },
    },
  });

  await supabase
    .from("registration")
    .update({ id_verification_status: "processing", id_verification_session_id: session.id })
    .eq("id", registration_id);

  return NextResponse.json({ client_secret: session.client_secret, status: "processing" });
}

/**
 * Poll the live verification status for a registration. Reconciles the Stripe
 * session onto the row (so the result lands even if the webhook is delayed) and
 * returns one of: unstarted | processing | verified | requires_input | canceled.
 */
export async function GET(request: Request) {
  const registrationId = new URL(request.url).searchParams.get("registration_id");
  const token = request.headers.get("x-guest-token") || "";

  if (!registrationId) {
    return NextResponse.json({ error: "registration_id is required" }, { status: 400 });
  }
  if (!verifyGuestToken(registrationId, token)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const { data: reg } = await supabase
    .from("registration")
    .select("id_verification_status, id_verification_session_id, id_name_match")
    .eq("id", registrationId)
    .single();

  if (!reg) {
    return NextResponse.json({ error: "Registration not found" }, { status: 404 });
  }
  if (reg.id_verification_status === "verified") {
    return NextResponse.json({ status: "verified", name_match: reg.id_name_match });
  }
  if (!reg.id_verification_session_id) {
    return NextResponse.json({ status: "unstarted" });
  }

  const session = await stripe.identity.verificationSessions.retrieve(
    reg.id_verification_session_id,
    { expand: ["verified_outputs"] },
  );
  const outcome = await finalizeIdentitySession(supabase, session);
  return NextResponse.json({ status: outcome });
}
