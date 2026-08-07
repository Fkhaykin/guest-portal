import type { Metadata } from "next";
import { JsonLd } from "@/components/seo/json-ld";
import { SITE_URL } from "@/lib/seo";
import ThingsToDoPage from "./things-to-do-client";

export const metadata: Metadata = {
  title: "Things to Do in the Poconos — A Local's Guide",
  description:
    "A local's guide to the Poconos: Bushkill Falls, Delaware Water Gap hikes, Camelback and Shawnee skiing, lake days, restaurants, and rainy-day family activities near East Stroudsburg.",
  alternates: { canonical: "/things-to-do" },
  openGraph: {
    title: "Things to Do in the Poconos — A Local's Guide",
    description:
      "Waterfalls, skiing, lakes, dining, and family activities — 40+ vetted local picks from your Summit Lakeside hosts.",
  },
};

export default function Page() {
  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
            { "@type": "ListItem", position: 2, name: "Things to Do in the Poconos" },
          ],
        }}
      />
      <ThingsToDoPage />
    </>
  );
}
