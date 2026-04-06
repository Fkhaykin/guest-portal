import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
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
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

const quickLinks = [
  {
    label: "Register",
    description: "Register your guests and vehicles",
    href: "/register",
    icon: ClipboardList,
  },
  {
    label: "Update Registration",
    description: "Edit guests, pets, or vehicles",
    href: "/update",
    icon: PenLine,
  },
  {
    label: "Add-Ons",
    description: "Extras and experiences for your stay",
    href: "/add-ons",
    icon: Gift,
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
    description: "Restaurants & attractions",
    href: "/recommendations",
    icon: MapPin,
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

export default async function PropertyHomePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: property } = await supabase
    .from("property")
    .select("*")
    .eq("slug", slug)
    .eq("is_active", true)
    .single();

  if (!property) notFound();

  return (
    <div className="space-y-8">
      <div className="text-center space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">
          Welcome!
        </h2>
        {property.description && (
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            {property.description}
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {quickLinks.map((item) => (
          <Link key={item.label} href={`/p/${slug}${item.href}`}>
            <Card className="h-full hover:bg-accent transition-colors cursor-pointer">
              <CardHeader className="flex flex-col items-center text-center p-4 gap-2">
                <item.icon className="h-8 w-8 text-primary" />
                <CardTitle className="text-base">{item.label}</CardTitle>
                <CardDescription className="text-xs">
                  {item.description}
                </CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
