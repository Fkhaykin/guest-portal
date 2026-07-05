import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  CLEANER_COOKIE_NAME,
  cleanerCookieOptions,
} from "@/lib/cleaner/cookie";

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
    pathname.startsWith("/_next") ||
    // In-house kiosk displays — same page on every subdomain
    pathname.startsWith("/kiosk") ||
    // PWA assets live in /public and must resolve on every subdomain —
    // prefixing them (e.g. /cleaner/sw.js) 404s and silently breaks
    // standalone install + push on the manager/admin subdomains.
    pathname === "/manifest.json" ||
    pathname === "/sw.js"
  );
}

export async function updateSession(request: NextRequest) {
  // --- Subdomain detection -------------------------------------------------
  const hostname = request.headers.get("host") || "";
  const subdomain = getSubdomain(hostname);
  const pathname = request.nextUrl.pathname;

  // Service calendar shorthand: the contractor URL uses ?=N (and ?N) to pick a
  // house. The empty-name param survives here in middleware but is stripped
  // from the page's searchParams in production builds, so normalize it to the
  // canonical ?house=N before the page renders.
  if (pathname === "/calendar") {
    const sp = request.nextUrl.searchParams;
    if (!sp.get("house") && !sp.get("h")) {
      let idx: string | null = null;
      const empty = sp.get(""); // ?=4
      if (empty && /^\d+$/.test(empty)) {
        idx = empty;
      } else {
        for (const [k, v] of sp.entries()) {
          if (/^\d+$/.test(k) && v === "") { idx = k; break; } // ?4
          if (v && /^\d+$/.test(v)) { idx = v; break; }
        }
      }
      if (idx) {
        const url = request.nextUrl.clone();
        url.search = "";
        url.searchParams.set("house", idx);
        return NextResponse.redirect(url);
      }
    }
  }

  const prefix = subdomain ? SUBDOMAIN_PREFIX_MAP[subdomain] : undefined;

  // Guest subdomain: rewrite only the root to /checkin (other paths stay as-is)
  const isGuestRoot = subdomain === "guest" && pathname === "/";

  // Manager/admin subdomains get their own PWA manifests so each portal
  // installs as a standalone app rather than a Safari bookmark.
  const MANIFEST_MAP: Record<string, string> = {
    manager: "/manifest-manager.json",
    admin: "/manifest-admin.json",
  };
  const manifestOverride =
    pathname === "/manifest.json" && subdomain
      ? MANIFEST_MAP[subdomain]
      : undefined;

  // Compute the internal path that Next.js will serve
  const needsRewrite =
    isGuestRoot ||
    !!manifestOverride ||
    (!!prefix && !shouldSkipRewrite(pathname) && !pathname.startsWith(prefix));
  const internalPath = manifestOverride
    ? manifestOverride
    : isGuestRoot
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

  // Only the admin portal relies on the Supabase user — for route protection
  // and session refresh. Guest and marketing routes are anonymous, and cleaner
  // routes use their own cookie (checked below). So we skip the getUser()
  // network round-trip everywhere except /admin, which is the bulk of (public)
  // traffic and the main source of per-navigation latency.
  if (internalPath.startsWith("/admin")) {
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

    // No Supabase auth cookie at all → definitely signed out. Skip the network
    // call and go straight to the login redirect.
    const hasAuthCookie = request.cookies
      .getAll()
      .some((c) => c.name.startsWith("sb-") && c.name.includes("auth-token"));

    let isAuthenticated = false;
    if (hasAuthCookie) {
      // Refresh the session — important for Server Components — and validate.
      const {
        data: { user },
        error: getUserError,
      } = await supabase.auth.getUser();

      isAuthenticated = !!user;

      // On mobile PWA cold-start, iOS hasn't established network by the time
      // middleware runs. getUser() makes a network call and returns null on
      // failure, which would bounce the user to login even with a valid
      // session. Fall back to the local session on a transient fetch error.
      if (!isAuthenticated && getUserError?.name === "AuthRetryableFetchError") {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        isAuthenticated = !!session;
      }
    }

    if (!isAuthenticated) {
      const url = request.nextUrl.clone();
      // Send the user back to the exact page they asked for after login —
      // pathname is the external (pre-rewrite) path, valid on any subdomain.
      // Keep the query string so deep links (e.g. /messages?booking=X from a
      // push notification) survive the round-trip.
      const redirectTo = `${pathname}${url.search}`;
      url.pathname = "/auth/login";
      url.search = "";
      url.searchParams.set("redirect", redirectTo);
      return NextResponse.redirect(url);
    }
  }

  // Protect cleaner routes (cookie presence check only; full validation in layout)
  if (
    internalPath.startsWith("/cleaner") &&
    !internalPath.startsWith("/cleaner/login")
  ) {
    const sessionToken = request.cookies.get(CLEANER_COOKIE_NAME)?.value;
    if (!sessionToken) {
      const url = request.nextUrl.clone();
      // On the manager subdomain, redirect to /login (which rewrites to /cleaner/login)
      url.pathname = subdomain === "manager" ? "/login" : "/cleaner/login";
      return NextResponse.redirect(url);
    }
    // Sliding renewal: re-issue the cookie on every visit so its maxAge never
    // runs out for an active cleaner (DB expiry is extended in the layout).
    supabaseResponse.cookies.set(
      CLEANER_COOKIE_NAME,
      sessionToken,
      cleanerCookieOptions()
    );
  }

  return supabaseResponse;
}
