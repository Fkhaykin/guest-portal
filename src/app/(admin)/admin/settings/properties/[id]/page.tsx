import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Users,
  ShoppingBag,
  Ticket,
  HelpCircle,
  Video,
  QrCode,
  Building2,
  Settings,
  TabletSmartphone,
} from "lucide-react";
import { PropertyActiveToggle } from "@/components/admin/property-active-toggle";

const sections = [
  {
    label: "Registrations",
    description: "View guest registrations and vehicles",
    href: "/registrations",
    icon: Users,
  },
  {
    label: "Services",
    description: "Manage purchasable add-ons",
    href: "/services",
    icon: ShoppingBag,
  },
  {
    label: "Promos",
    description: "Build offers — codes, automatic discounts, free nights & perks",
    href: "/promos",
    icon: Ticket,
  },
  {
    label: "FAQs",
    description: "Manage frequently asked questions",
    href: "/faqs",
    icon: HelpCircle,
  },
  {
    label: "Videos",
    description: "Upload instructional and welcome videos",
    href: "/videos",
    icon: Video,
  },
  {
    label: "QR Codes",
    description: "Generate and manage QR codes",
    href: "/qr-codes",
    icon: QrCode,
  },
  {
    label: "Kiosk",
    description: "Wall-display URL, QR, and device setup for the in-house kiosk",
    href: "/kiosk",
    icon: TabletSmartphone,
  },
  {
    label: "Owner / HOA Settings",
    description: "Owner info, lot/section, HOA email for PDF submissions",
    href: "/owner-settings",
    icon: Building2,
  },
  {
    label: "Property Settings",
    description: "Name, address, and general property details",
    href: "/settings",
    icon: Settings,
  },
];

export default async function PropertyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: property } = await supabase
    .from("property")
    .select("*")
    .eq("id", id)
    .single();

  if (!property) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {property.name}
          </h1>
          <p className="text-muted-foreground">
            {property.address || `/p/${property.slug}`}
          </p>
        </div>
        <PropertyActiveToggle
          propertyId={property.id}
          initialActive={property.is_active}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {sections.map((section) => (
          <Link
            key={section.label}
            href={`/admin/settings/properties/${id}${section.href}`}
          >
            <Card className="h-full hover:bg-accent/50 transition-colors cursor-pointer">
              <CardHeader className="flex flex-row items-start gap-3">
                <section.icon className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <CardTitle className="text-base">{section.label}</CardTitle>
                  <CardDescription className="text-xs">
                    {section.description}
                  </CardDescription>
                </div>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
