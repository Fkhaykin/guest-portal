// Cleaner session cookie constants, shared between the session helpers
// (next/headers) and the proxy middleware (NextResponse cookies). Kept free of
// next/headers imports so the middleware can use them.

export const CLEANER_COOKIE_NAME = "cleaner_session";
export const CLEANER_SESSION_MAX_AGE = 60 * 24 * 60 * 60; // 60 days in seconds

export function cleanerCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: CLEANER_SESSION_MAX_AGE,
  };
}
