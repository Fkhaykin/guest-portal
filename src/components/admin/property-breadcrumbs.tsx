"use client";

import { useSelectedLayoutSegment } from "next/navigation";
import { Breadcrumbs } from "@/components/admin/breadcrumbs";

const sectionLabels: Record<string, string> = {
  registrations: "Registrations",
  services: "Services",
  promos: "Promos",
  promotions: "Promos",
  "promo-codes": "Promos",
  faqs: "FAQs",
  videos: "Videos",
  "qr-codes": "QR Codes",
  "owner-settings": "Owner / HOA Settings",
  settings: "Property Settings",
};

export function PropertyBreadcrumbs({
  propertyId,
  propertyName,
}: {
  propertyId: string;
  propertyName: string;
}) {
  const segment = useSelectedLayoutSegment();
  const section = segment ? sectionLabels[segment] ?? segment : null;

  return (
    <Breadcrumbs
      items={[
        { label: "Settings", href: "/admin/settings" },
        { label: "Properties", href: "/admin/settings?tab=properties" },
        {
          label: propertyName,
          href: section ? `/admin/settings/properties/${propertyId}` : undefined,
        },
        ...(section ? [{ label: section }] : []),
      ]}
    />
  );
}
