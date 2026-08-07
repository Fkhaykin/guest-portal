import type { Metadata } from "next";
import SearchPage from "./search-client";

export const metadata: Metadata = {
  title: "Check Availability — Poconos Lake House Rentals",
  description:
    "See live availability across our five Poconos lakefront vacation homes. Filter by dates, guests, and pets — book direct with no platform fees.",
  alternates: { canonical: "/search" },
  openGraph: {
    title: "Check Availability — Poconos Lake House Rentals",
    description:
      "See live availability across our five Poconos lakefront vacation homes. Book direct with no platform fees.",
  },
};

export default function Page() {
  return <SearchPage />;
}
