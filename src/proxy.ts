import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { isIndexableHost } from "@/lib/seo";

export async function proxy(request: NextRequest) {
  const response = await updateSession(request);
  // Only www/apex summitlakeside.com may be indexed. The guest/admin/manager/
  // kiosk subdomains and the *.vercel.app aliases serve the same app — without
  // this they compete with the canonical host in search.
  if (!isIndexableHost(request.headers.get("host"))) {
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
  }
  return response;
}

export const config = {
  matcher: [
    // Match all routes except static files and Next.js internals
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
