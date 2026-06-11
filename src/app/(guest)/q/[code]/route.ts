import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const supabase = createAdminClient();

  const { data: qrCode } = await supabase
    .from("qr_code")
    .select("*, property:property_id(slug)")
    .eq("code", code)
    .eq("is_active", true)
    .single();

  if (!qrCode || !qrCode.property) {
    return new NextResponse("Not found", { status: 404 });
  }

  // Increment scan count (fire and forget)
  supabase
    .from("qr_code")
    .update({ scan_count: qrCode.scan_count + 1 })
    .eq("id", qrCode.id)
    .then();

  const slug = (qrCode.property as { slug: string }).slug;
  const base = `/p/${slug}`;

  let target: string;
  let external = false;
  switch (qrCode.target_type) {
    case "video":
      target = `${base}/videos/${qrCode.target_id}`;
      break;
    case "services":
      target = `${base}/services`;
      break;
    case "faq":
      target = `${base}/faq`;
      break;
    case "registration":
      target = `${base}/register`;
      break;
    case "custom_url":
      if (qrCode.custom_url) {
        target = /^https?:\/\//i.test(qrCode.custom_url)
          ? qrCode.custom_url
          : `https://${qrCode.custom_url}`;
        external = true;
      } else {
        target = base;
      }
      break;
    case "home":
    default:
      target = base;
  }

  // For external URLs, return an HTML page that redirects client-side.
  // A 3xx response would become an opaque-redirect inside the PWA service
  // worker and silently fail. A 200 HTML response always passes through.
  if (external) {
    const escaped = target.replace(/"/g, "&quot;").replace(/</g, "&lt;");
    const json = JSON.stringify(target);
    const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="robots" content="noindex"><meta http-equiv="refresh" content="0; url=${escaped}"><title>Redirecting…</title><script>window.location.replace(${json})</script></head><body><p>Redirecting to <a href="${escaped}">${escaped}</a>…</p></body></html>`;
    return new NextResponse(html, {
      status: 200,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
      },
    });
  }

  return NextResponse.redirect(new URL(target, _request.url), { status: 307 });
}
