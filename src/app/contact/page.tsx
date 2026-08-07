import type { Metadata } from "next";
import ContactPage from "./contact-client";

export const metadata: Metadata = {
  title: "Contact Us",
  description:
    "Questions about a stay, a booking, or our homes? Reach Summit Lakeside by phone, email, or message — we typically reply within the hour.",
  alternates: { canonical: "/contact" },
  openGraph: {
    title: "Contact Summit Lakeside Rentals",
    description:
      "Questions about a stay, a booking, or our homes? We typically reply within the hour.",
  },
};

export default function Page() {
  return <ContactPage />;
}
