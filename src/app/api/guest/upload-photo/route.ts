import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyGuestToken } from "@/lib/guest-token";
import { checkPhotoRewardEligibility, PHOTO_REWARD_THRESHOLD } from "@/lib/photo-reward";

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const registrationId = formData.get("registration_id") as string | null;
  const caption = formData.get("caption") as string | null;

  if (!file || !registrationId) {
    return NextResponse.json(
      { error: "file and registration_id are required" },
      { status: 400 }
    );
  }

  const token = request.headers.get("x-guest-token") || "";
  if (!verifyGuestToken(registrationId, token)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/heic"];
  if (!allowedTypes.includes(file.type)) {
    return NextResponse.json(
      { error: "File must be a JPEG, PNG, WebP, or HEIC image" },
      { status: 400 }
    );
  }

  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json(
      { error: "File must be under 10MB" },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();

  // Get registration with property_id and guest name
  const { data: reg } = await supabase
    .from("registration")
    .select("id, property_id, guest_id, photo_reward_claimed")
    .eq("id", registrationId)
    .single();

  if (!reg) {
    return NextResponse.json({ error: "Registration not found" }, { status: 404 });
  }

  const { data: guest } = await supabase
    .from("guest")
    .select("full_name")
    .eq("id", reg.guest_id)
    .single();

  const ext = file.name.split(".").pop() || "jpg";
  const timestamp = Date.now();
  const path = `${reg.property_id}/${registrationId}/${timestamp}.${ext}`;

  const buffer = await file.arrayBuffer();

  const { error: uploadError } = await supabase.storage
    .from("guest-photos")
    .upload(path, buffer, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    console.error("[upload-photo] Upload failed:", uploadError);
    return NextResponse.json(
      { error: "Upload failed. Please try again." },
      { status: 500 }
    );
  }

  const { data: photo, error: insertError } = await supabase
    .from("guest_photo")
    .insert({
      registration_id: registrationId,
      property_id: reg.property_id,
      file_path: path,
      caption: caption || null,
      guest_name: guest?.full_name || null,
    })
    .select("id, file_path, caption, created_at")
    .single();

  if (insertError) {
    console.error("[upload-photo] Insert failed:", insertError);
    return NextResponse.json(
      { error: "Failed to save photo record." },
      { status: 500 }
    );
  }

  // Check if guest has earned the late checkout reward
  let rewardEarned = false;
  let rewardBlockedReason: string | null = null;
  if (!reg.photo_reward_claimed) {
    const { count } = await supabase
      .from("guest_photo")
      .select("id", { count: "exact", head: true })
      .eq("registration_id", registrationId);

    if (count && count >= PHOTO_REWARD_THRESHOLD) {
      const eligibility = await checkPhotoRewardEligibility(supabase, registrationId);
      if (!eligibility.eligible) {
        rewardBlockedReason = eligibility.reason;
      } else {
        const { data: currentReg } = await supabase
          .from("registration")
          .select("upsells")
          .eq("id", registrationId)
          .single();

        const currentUpsells = (currentReg?.upsells as unknown[]) || [];
        const updatedUpsells = [
          ...currentUpsells,
          {
            type: "late_checkout",
            label: "Late Check-Out (12:00 PM — Photo Album Reward)",
            price_cents: 0,
            status: "paid",
            meta: { source: "photo_reward", checkout_time: "12:00 PM" },
          },
        ];

        await supabase
          .from("registration")
          .update({
            upsells: updatedUpsells,
            photo_reward_claimed: true,
          })
          .eq("id", registrationId);

        rewardEarned = true;
      }
    }
  }

  return NextResponse.json({
    ok: true,
    photo,
    reward_earned: rewardEarned,
    reward_blocked_reason: rewardBlockedReason,
  });
}
