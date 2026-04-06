"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Mountain, TreePine, Waves, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

const SESSION_KEY = "guest-portal-session";

type SessionData = {
  guestName: string;
  reservation: {
    property: { slug: string; name: string };
  };
};

export function GuestHeader() {
  const [session, setSession] = useState<SessionData | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      if (raw) setSession(JSON.parse(raw));
    } catch {
      // Ignore
    }

    // Listen for storage changes (e.g. login/logout in same tab)
    function onStorage() {
      try {
        const raw = sessionStorage.getItem(SESSION_KEY);
        setSession(raw ? JSON.parse(raw) : null);
      } catch {
        setSession(null);
      }
    }

    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  if (!mounted) return null;

  const firstName = session?.guestName?.split(" ")[0];

  return (
    <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-40">
      <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 text-foreground hover:opacity-80 transition-opacity">
          <div className="flex gap-1 text-muted-foreground">
            <Mountain className="h-4 w-4" />
            <TreePine className="h-4 w-4" />
            <Waves className="h-4 w-4" />
          </div>
          <span className="font-semibold text-lg">Guest Portal</span>
        </Link>

        {session && (
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground hidden sm:inline">
              Hi, {firstName}
            </span>
            <Link href="/">
              <Button variant="outline" size="sm">
                My Booking
              </Button>
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}

export function PropertyHeader({
  propertyName,
  showBack = false,
}: {
  propertyName: string;
  showBack?: boolean;
}) {
  const [hasSession, setHasSession] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      setHasSession(!!sessionStorage.getItem(SESSION_KEY));
    } catch {
      // Ignore
    }
  }, []);

  return (
    <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-40">
      <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          {mounted && hasSession && (
            <Link href="/" className="text-muted-foreground hover:text-foreground transition-colors shrink-0">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          )}
          <h1 className="font-semibold text-lg truncate">
            {propertyName}
          </h1>
        </div>
        {mounted && hasSession && (
          <Link href="/">
            <Button variant="outline" size="sm" className="shrink-0">
              My Booking
            </Button>
          </Link>
        )}
      </div>
    </header>
  );
}
