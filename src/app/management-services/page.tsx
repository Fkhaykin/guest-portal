import type { Metadata } from "next";
import ManagementServicesPage from "./management-services-client";

export const metadata: Metadata = {
  title: "Poconos Vacation Rental Property Management",
  description:
    "Full-service short-term rental management in the Poconos: listings, dynamic pricing, cleaning, maintenance, and 24/7 guest messaging. Family-run, owner-first.",
  alternates: { canonical: "/management-services" },
  openGraph: {
    title: "Poconos Vacation Rental Property Management",
    description:
      "Full-service short-term rental management in the Poconos, from a family that operates its own five lakefront homes.",
  },
};

export default function Page() {
  return <ManagementServicesPage />;
}
