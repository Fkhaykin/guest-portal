"use client";

import { useState, useEffect, useContext } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PropertyContext } from "@/hooks/use-property";
import {
  Home,
  ClipboardList,
  PenLine,
  Tag,
  MapPin,
  HelpCircle,
} from "lucide-react";

const SESSION_KEY = "guest-portal-session";

export function GuestNav({ slug: slugProp }: { slug?: string } = {}) {
  const property = useContext(PropertyContext);
  const base = `/p/${slugProp ?? property?.slug}`;
  const pathname = usePathname();
  const [isRegistered, setIsRegistered] = useState(false);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      if (raw) {
        const session = JSON.parse(raw);
        setIsRegistered(!!session.reservation?.signature_url);
      }
    } catch {
      // ignore
    }
  }, []);

  const navItems: { label: string; href: string; icon: typeof Home; absolute?: boolean; home?: boolean }[] = [
    isRegistered
      ? { label: "Manage", href: "/update", icon: PenLine }
      : { label: "Register", href: "/register", icon: ClipboardList },
    { label: "Promotions", href: "/promotions", icon: Tag },
    { label: "Home", href: "/", icon: Home, absolute: true, home: true },
    { label: "Explore", href: "/things-to-do", icon: MapPin, absolute: true },
    { label: "FAQ", href: "/faq", icon: HelpCircle },
  ];

  return (
    <nav
      aria-label="Property portal"
      data-kiosk-hide
      className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/90 backdrop-blur-lg pb-[env(safe-area-inset-bottom)] md:relative md:border-t-0 md:border-b md:pb-0"
    >
      <div className="grid grid-cols-5 md:flex md:items-center md:justify-center md:gap-6 px-2 py-2 max-w-4xl mx-auto">
        {navItems.map((item) => {
          const href = item.absolute ? item.href : `${base}${item.href}`;
          const isActive = item.home
            ? pathname === "/" || pathname === base
            : item.absolute
              ? pathname.startsWith(item.href)
              : pathname.startsWith(href);
          return (
            <Link
              key={item.label}
              href={href}
              aria-current={isActive ? "page" : undefined}
              className={`relative flex min-h-12 flex-col items-center justify-center gap-1 rounded-lg px-2 py-1.5 transition-colors duration-200 active:scale-95 md:min-w-16 ${
                isActive
                  ? "font-medium text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <item.icon className={`h-5 w-5 ${isActive ? "stroke-[2.5]" : ""}`} />
              <span className="text-xs">{item.label}</span>
              {/* A tinted pill behind five items made the bar noisy; the
                  active item is marked by a dot instead, which becomes an
                  underline once the bar moves to the top on md+. */}
              {isActive && (
                <span
                  aria-hidden="true"
                  className="absolute bottom-0.5 h-1 w-1 rounded-full bg-primary md:inset-x-2 md:bottom-[-9px] md:h-0.5 md:w-auto md:rounded-none"
                />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
