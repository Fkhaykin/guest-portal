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
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t md:relative md:border-t-0 md:border-b">
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
              className={`relative flex flex-col items-center gap-1 px-2 py-1 rounded-lg transition-colors md:min-w-[4rem] ${
                isActive
                  ? "text-primary font-medium bg-primary/10"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {isActive && (
                <span className="absolute -top-2 left-1/2 -translate-x-1/2 h-1 w-8 rounded-full bg-primary" />
              )}
              <item.icon className={`h-5 w-5 ${isActive ? "stroke-[2.5]" : ""}`} />
              <span className="text-xs">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
