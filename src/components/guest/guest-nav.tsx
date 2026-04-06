"use client";

import Link from "next/link";
import { useProperty } from "@/hooks/use-property";
import {
  Home,
  ClipboardList,
  ShoppingBag,
  Tag,
  MapPin,
  HelpCircle,
  Video,
  Gift,
} from "lucide-react";

const navItems = [
  { label: "Home", href: "", icon: Home },
  { label: "Register", href: "/register", icon: ClipboardList },
  { label: "Add-Ons", href: "/add-ons", icon: Gift },
  { label: "Services", href: "/services", icon: ShoppingBag },
  { label: "Promotions", href: "/promotions", icon: Tag },
  { label: "Explore", href: "/recommendations", icon: MapPin },
  { label: "FAQ", href: "/faq", icon: HelpCircle },
  { label: "Videos", href: "/videos", icon: Video },
];

export function GuestNav() {
  const property = useProperty();
  const base = `/p/${property.slug}`;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t md:relative md:border-t-0 md:border-b">
      <div className="flex items-center justify-around md:justify-center md:gap-6 px-2 py-2 max-w-4xl mx-auto overflow-x-auto">
        {navItems.map((item) => (
          <Link
            key={item.label}
            href={`${base}${item.href}`}
            className="flex flex-col items-center gap-1 px-2 py-1 text-muted-foreground hover:text-foreground transition-colors min-w-[4rem]"
          >
            <item.icon className="h-5 w-5" />
            <span className="text-xs">{item.label}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}
