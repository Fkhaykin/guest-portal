"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  ClipboardList,
  ShoppingBag,
  Tag,
  MapPin,
  HelpCircle,
  Video,
  PenLine,
  Gift,
  Truck,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

const SESSION_KEY = "guest-portal-session";

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
    label: "Services",
    description: "Browse additional services",
    href: "/services",
    icon: ShoppingBag,
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
  {
    label: "Videos",
    description: "How-to guides & welcome",
    href: "/videos",
    icon: Video,
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
            <CardHeader className="flex flex-col items-center text-center p-4 gap-2">
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10">
                <item.icon className="h-7 w-7 text-primary" />
              </div>
              <CardTitle className="text-base">{item.label}</CardTitle>
              <CardDescription className="text-xs">
                {item.description}
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>
      ))}
    </div>
  );
}
