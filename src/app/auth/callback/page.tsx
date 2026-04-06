"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Suspense } from "react";

function CallbackHandler() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const code = searchParams.get("code");
    const redirect = searchParams.get("redirect") || "/";

    if (code) {
      const supabase = createClient();
      supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
        if (error) {
          const loginUrl = new URL("/auth/login", window.location.origin);
          loginUrl.searchParams.set("error", error.message);
          window.location.href = loginUrl.toString();
        } else {
          window.location.href = redirect;
        }
      });
    } else {
      window.location.href = "/auth/login";
    }
  }, [searchParams]);

  return (
    <main className="flex-1 flex items-center justify-center p-6">
      <p className="text-muted-foreground">Signing you in...</p>
    </main>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense>
      <CallbackHandler />
    </Suspense>
  );
}
