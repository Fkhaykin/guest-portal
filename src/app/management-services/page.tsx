import type { Metadata } from "next";
import { JsonLd } from "@/components/seo/json-ld";
import { ogMeta } from "@/lib/seo";
import { FAQS } from "./faq-data";
import ManagementServicesPage from "./management-services-client";

export const metadata: Metadata = {
  title: "Poconos Vacation Rental Property Management",
  description:
    "Full-service short-term rental management in the Poconos: listings, dynamic pricing, cleaning, maintenance, and 24/7 guest messaging. Family-run, owner-first.",
  alternates: { canonical: "/management-services" },
  openGraph: ogMeta({
    title: "Poconos Vacation Rental Property Management",
    description:
      "Full-service short-term rental management in the Poconos, from a family that operates its own five lakefront homes.",
  }),
};

export default function Page() {
  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: FAQS.map((faq) => ({
            "@type": "Question",
            name: faq.q,
            acceptedAnswer: { "@type": "Answer", text: faq.a },
          })),
        }}
      />
      <ManagementServicesPage />
    </>
  );
}
