import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Subdomain routing
// ---------------------------------------------------------------------------
// Subdomains:
//   guest.summitlakeside.com  → guest portal (no rewrite, root is already guest)
//   admin.summitlakeside.com  → prepend /admin to path
//   manager.summitlakeside.com → prepend /cleaner to path
//
// For local dev, use admin.localhost:3000 / manager.localhost:3000 etc.
// ---------------------------------------------------------------------------

const SUBDOMAIN_PREFIX_MAP: Record<string, string> = {
  admin: "/admin",
  manager: "/cleaner",
  // guest needs no rewrite — root page is the guest portal
};

function getSubdomain(hostname: string): string | null {
  // Strip port
  const host = hostname.split(":")[0];

  // localhost subdomains: admin.localhost, manager.localhost, guest.localhost
  if (host.endsWith(".localhost")) {
    const sub = host.split(".")[0];
    return ["admin", "guest", "manager"].includes(sub) ? sub : null;
  }

  // Production / preview: admin.summitlakeside.com, etc.
  const parts = host.split(".");
  if (parts.length >= 3) {
    const sub = parts[0];
    return ["admin", "guest", "manager"].includes(sub) ? sub : null;
  }

  return null;
}

// Paths that should never be rewritten (shared across all subdomains)
function shouldSkipRewrite(pathname: string): boolean {
  return (
    pathname.startsWith("/api") ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/_next")
  );
}

export async function updateSession(request: NextRequest) {
  // --- Subdomain detection -------------------------------------------------
  const hostname = request.headers.get("host") || "";
  const subdomain = getSubdomain(hostname);
  const pathname = request.nextUrl.pathname;

  const prefix = subdomain ? SUBDOMAIN_PREFIX_MAP[subdomain] : undefined;

  // Guest subdomain: rewrite only the root to /checkin (other paths stay as-is)
  const isGuestRoot = subdomain === "guest" && pathname === "/";

  // Compute the internal path that Next.js will serve
  const needsRewrite =
    isGuestRoot ||
    (!!prefix && !shouldSkipRewrite(pathname) && !pathname.startsWith(prefix));
  const internalPath = isGuestRoot
    ? "/checkin"
    : needsRewrite
      ? `${prefix}${pathname === "/" ? "" : pathname}`
      : pathname;

  // Helper: create the base response (rewrite or next) preserving the request
  function makeResponse() {
    if (needsRewrite) {
      const rewriteUrl = request.nextUrl.clone();
      rewriteUrl.pathname = internalPath;
      return NextResponse.rewrite(rewriteUrl, { request });
    }
    return NextResponse.next({ request });
  }

  // --- Supabase session ---------------------------------------------------
  let supabaseResponse = makeResponse();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = makeResponse();
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh the session — important for Server Components
  const {
    data: { user },
    error: getUserError,
  } = await supabase.auth.getUser();

  // On mobile PWA cold-start, iOS hasn't established network by the time
  // middleware runs. getUser() always makes a network call and returns null on
  // failure, which would redirect the user to login even with a valid session.
  // Fall back to a local getSession() check when it's a transient fetch error.
  let isAuthenticated = !!user;
  if (!isAuthenticated && getUserError?.name === "AuthRetryableFetchError") {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    isAuthenticated = !!session;
  }

  // Protect admin routes
  if (internalPath.startsWith("/admin") && !isAuthenticated) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/login";
    // On the admin subdomain, redirect back to / (which rewrites to /admin)
    url.searchParams.set("redirect", subdomain === "admin" ? "/" : internalPath);
    return NextResponse.redirect(url);
  }

  // Protect cleaner routes (cookie presence check only; full validation in layout)
  if (
    internalPath.startsWith("/cleaner") &&
    !internalPath.startsWith("/cleaner/login")
  ) {
    const sessionToken = request.cookies.get("cleaner_session")?.value;
    if (!sessionToken) {
      const url = request.nextUrl.clone();
      // On the manager subdomain, redirect to /login (which rewrites to /cleaner/login)
      url.pathname = subdomain === "manager" ? "/login" : "/cleaner/login";
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}
