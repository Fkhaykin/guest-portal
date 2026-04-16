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
  Gift,
  Camera,
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

  const navItems = [
    { label: "Home", href: "/", icon: Home, absolute: true },
    isRegistered
      ? { label: "Manage Stay", href: "/update", icon: PenLine }
      : { label: "Register", href: "/register", icon: ClipboardList },
    { label: "Add-Ons", href: "/add-ons", icon: Gift },
    { label: "Photos", href: "/photos", icon: Camera },
    { label: "Promotions", href: "/promotions", icon: Tag },
    { label: "Explore", href: "/recommendations", icon: MapPin },
    { label: "FAQ", href: "/faq", icon: HelpCircle },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t md:relative md:border-t-0 md:border-b">
      <div className="flex items-center justify-around md:justify-center md:gap-6 px-2 py-2 max-w-4xl mx-auto overflow-x-auto">
        {navItems.map((item) => {
          const href = "absolute" in item ? item.href : `${base}${item.href}`;
          const isActive =
            "absolute" in item
              ? pathname === "/" || pathname === base
              : pathname.startsWith(href);
          return (
            <Link
              key={item.label}
              href={href}
              className={`flex flex-col items-center gap-1 px-2 py-1 transition-colors min-w-[4rem] ${
                isActive
                  ? "text-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <item.icon className={`h-5 w-5 ${isActive ? "stroke-[2.5]" : ""}`} />
              <span className="text-xs">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
