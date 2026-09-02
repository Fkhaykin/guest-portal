"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  ClipboardList,
  Tag,
  MapPin,
  HelpCircle,
  PenLine,
  Gift,
  Truck,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { IconTile } from "@/components/ui/icon-tile";
import type { Accent } from "@/lib/status-styles";

const SESSION_KEY = "guest-portal-session";

// Services and Videos are hidden until that content exists — restore their
// tiles here when it does.
// Accents are decorative variety, not status — one per destination so the
// grid reads as six different places rather than six identical cards.
const baseLinks: {
  label: string;
  description: string;
  href: string;
  icon: typeof Gift;
  accent?: Accent;
  absolute?: boolean;
}[] = [
  {
    label: "Add-Ons",
    description: "Extras and experiences for your stay",
    href: "/add-ons",
    icon: Gift,
    accent: "sand",
  },
  {
    label: "Delivery / Rideshare",
    description: "Register deliveries and rides",
    href: "/delivery",
    icon: Truck,
    accent: "dusk",
  },
  {
    label: "Promotions",
    description: "See current deals",
    href: "/promotions",
    icon: Tag,
    accent: "ember",
  },
  {
    label: "Explore",
    description: "Things to do in the Poconos",
    href: "/things-to-do",
    icon: MapPin,
    accent: "pine",
    absolute: true,
  },
  {
    label: "FAQ",
    description: "Frequently asked questions",
    href: "/faq",
    icon: HelpCircle,
  },
];

export function QuickLinks({ slug }: { slug: string }) {
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

  const registrationLink = isRegistered
    ? {
        label: "Update Registration",
        description: "Edit guests, pets, or vehicles",
        href: "/update",
        icon: PenLine,
        accent: "lake" as const,
      }
    : {
        label: "Register",
        description: "Register your guests and vehicles",
        href: "/register",
        icon: ClipboardList,
        accent: "lake" as const,
      };

  const quickLinks = [registrationLink, ...baseLinks];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
      {quickLinks.map((item) => (
        <Link
          key={item.label}
          href={"absolute" in item && item.absolute ? item.href : `/p/${slug}${item.href}`}
          className="rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/25"
        >
          <Card className="h-full cursor-pointer py-0 transition-[transform,box-shadow] duration-200 ease-out-soft hover:-translate-y-0.5 hover:shadow-raised active:translate-y-0 active:shadow-card">
            <CardHeader className="flex flex-row items-center gap-3 p-4">
              <IconTile icon={item.icon} size="sm" accent={item.accent} />
              <div className="min-w-0 space-y-0.5">
                <CardTitle className="text-sm leading-tight">{item.label}</CardTitle>
                <CardDescription className="text-xs leading-snug">
                  {item.description}
                </CardDescription>
              </div>
            </CardHeader>
          </Card>
        </Link>
      ))}
    </div>
  );
}
