import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { User } from "@supabase/supabase-js";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing sessions.
          }
        },
      },
    }
  );
}

/**
 * getUser() with the same transient-failure fallback as the middleware
 * (lib/supabase/middleware.ts): getUser() always makes a network call to
 * Supabase, and on mobile PWA cold-start it can fail with a retryable fetch
 * error even though the session cookie is valid. Without the fallback that
 * null bounces a logged-in user to /auth/login.
 */
export async function getAuthenticatedUser(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<User | null> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (user) return user;

  if (error?.name === "AuthRetryableFetchError") {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session?.user ?? null;
  }

  return null;
}
