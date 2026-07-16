import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Per-kiosk PWA manifest. Chrome's "Add to Home screen"/install installs the
 * manifest's `start_url`, NOT the current page — with the shared root manifest
 * (start_url "/") that meant every kiosk install landed on the marketing home
 * page. This manifest pins the install to THIS kiosk's deep URL and launches it
 * fullscreen (no address bar, no tabs), so a tablet added to the home screen
 * boots straight into the right house's kiosk.
 *
 * `scope` stays "/" so the kiosk's portal hand-off pages (register / update /
 * add-ons under /p/[slug]/*) open inside the installed app instead of popping a
 * browser tab. `id` is per-token so each house installs as its own distinct app
 * even though they share a scope.
 *
 * Requested anonymously by the browser, so it reads via the service role.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  const admin = createAdminClient();
  const { data: kiosk } = await admin
    .from("kiosk")
    .select("token, pin, property:property_id(name, nickname)")
    .eq("token", token)
    .maybeSingle();

  if (!kiosk) {
    return new NextResponse("Not found", { status: 404 });
  }

  const property = Array.isArray(kiosk.property)
    ? kiosk.property[0]
    : kiosk.property;
  const rawName: string =
    property?.nickname || property?.name || "Guest Kiosk";
  // Nicknames are stored lowercased for grouping (e.g. "chalet"); capitalize
  // the leading letter so the home-screen label reads cleanly without mangling
  // names that already have their own casing ("Bianca's", "Mansion/BML").
  const houseName = rawName.charAt(0).toUpperCase() + rawName.slice(1);

  // The PIN rides in start_url so kiosk browsers that clear storage between
  // boots (Edge/Fully Kiosk) re-authorize the device on every launch; the page
  // scrubs it from the address bar immediately.
  const startUrl = `/kiosk/${kiosk.token}?pin=${kiosk.pin}`;

  const manifest = {
    id: `/kiosk/${kiosk.token}`,
    name: `${houseName} — Kiosk`,
    short_name: houseName.slice(0, 24),
    description: `Guest kiosk for ${houseName}`,
    start_url: startUrl,
    scope: "/",
    display: "fullscreen",
    display_override: ["fullscreen", "standalone"],
    background_color: "#15171c",
    theme_color: "#15171c",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any maskable",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any maskable",
      },
    ],
  };

  return NextResponse.json(manifest, {
    headers: {
      "Content-Type": "application/manifest+json",
      // Kiosk credentials can rotate; keep this short so a re-provisioned
      // device doesn't cling to a stale start_url/PIN.
      "Cache-Control": "public, max-age=300",
    },
  });
}
