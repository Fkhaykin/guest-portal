import type { Metadata } from "next";
import WhySummitPage from "./why-summit-client";

export const metadata: Metadata = {
  title: "Why Book Direct With Us",
  description:
    "Family-run lakefront rentals in the Poconos. Book direct for the lowest rates, no platform service fees, flexible stays, and hosts who answer within minutes.",
  alternates: { canonical: "/why-summit" },
  openGraph: {
    title: "Why Book Direct With Summit Lakeside",
    description:
      "The same lakefront homes you see on Airbnb and Vrbo — without the service fees, and with the owners a text away.",
  },
};

export default function Page() {
  return <WhySummitPage />;
}
