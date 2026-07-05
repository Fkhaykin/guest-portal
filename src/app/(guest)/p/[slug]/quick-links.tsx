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

const SESSION_KEY = "guest-portal-session";

// Services and Videos are hidden until that content exists — restore their
// tiles here when it does.
const baseLinks = [
  {
    label: "Add-Ons",
    description: "Extras and experiences for your stay",
    href: "/add-ons",
    icon: Gift,
  },
  {
    label: "Delivery / Rideshare",
    description: "Register deliveries and rides",
    href: "/delivery",
    icon: Truck,
  },
  {
    label: "Promotions",
    description: "See current deals",
    href: "/promotions",
    icon: Tag,
  },
  {
    label: "Explore",
    description: "Things to do in the Poconos",
    href: "/things-to-do",
    icon: MapPin,
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
      }
    : {
        label: "Register",
        description: "Register your guests and vehicles",
        href: "/register",
        icon: ClipboardList,
      };

  const quickLinks = [registrationLink, ...baseLinks];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
      {quickLinks.map((item) => (
        <Link
          key={item.label}
          href={"absolute" in item && item.absolute ? item.href : `/p/${slug}${item.href}`}
          className="rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <Card className="h-full cursor-pointer ring-1 ring-border/60 transition-all hover:-translate-y-0.5 hover:shadow-md hover:ring-border">
            <CardHeader className="flex flex-row items-center p-4 gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <item.icon className="h-4.5 w-4.5 text-primary" />
              </div>
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
