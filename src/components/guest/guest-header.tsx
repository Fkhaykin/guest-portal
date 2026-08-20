"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";

const SESSION_KEY = "guest-portal-session";

// Marketing website homepage (bare domain). Absolute so the logo crosses from
// the guest subdomain — where "/" is rewritten to /checkin — to the main site.
const WEBSITE_URL = "https://summitlakeside.com";

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
        <Link href={WEBSITE_URL} className="hover:opacity-80 transition-opacity">
          <Image
            src="/logo.png"
            alt="Summit Lakeside"
            width={120}
            height={60}
            className="h-8 w-auto invert dark:invert-0"
            priority
          />
        </Link>

        {session && (
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground hidden sm:inline">
              Hi, {firstName}
            </span>
            <Link href="/checkin">
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
    <header
      data-kiosk-hide
      className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-40"
    >
      <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          {mounted && hasSession && showBack && (
            <Link href="/" className="text-muted-foreground hover:text-foreground transition-colors shrink-0">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          )}
          <Link href={WEBSITE_URL} className="shrink-0 hover:opacity-80 transition-opacity">
            <Image
              src="/logo.png"
              alt="Summit Lakeside"
              width={120}
              height={60}
              className="h-8 w-auto invert dark:invert-0"
              priority
            />
          </Link>
          <span className="text-muted-foreground hidden sm:inline">|</span>
          <h1 className="font-semibold text-base sm:text-lg truncate">
            {propertyName}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          {mounted && hasSession && (
            <Link href="/checkin">
              <Button variant="outline" size="sm" className="shrink-0">
                My Booking
              </Button>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
