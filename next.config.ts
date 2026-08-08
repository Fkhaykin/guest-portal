import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/en/the-summit-lakehouse-rental-agreement",
        has: [{ type: "host", value: "www.summitlakeside.com" }],
        destination: "https://guest.summitlakeside.com",
        permanent: true,
      },
      {
        source: "/en/the-summit-chateau-rental-agreement",
        has: [{ type: "host", value: "www.summitlakeside.com" }],
        destination: "https://guest.summitlakeside.com",
        permanent: true,
      },
      {
        source: "/en/the-summit-cottage-rental-agreement",
        has: [{ type: "host", value: "www.summitlakeside.com" }],
        destination: "https://guest.summitlakeside.com",
        permanent: true,
      },
      {
        source: "/en/the-summit-manor-rental-agreement",
        has: [{ type: "host", value: "www.summitlakeside.com" }],
        destination: "https://guest.summitlakeside.com",
        permanent: true,
      },
      {
        source: "/en/the-summit-chalet-rental-agreement",
        has: [{ type: "host", value: "www.summitlakeside.com" }],
        destination: "https://guest.summitlakeside.com",
        permanent: true,
      },
      // --- Legacy Lodgify-site URLs still in Google's index. Recover their
      // equity by pointing each at its modern equivalent. Order matters: the
      // specific entries above and below must precede the /en catch-all.
      // Targets chosen from the GSC 16-month export (Aug 2026): the numbered
      // pages below earned real clicks/impressions and must keep topical
      // relevance rather than falling through to "/".
      {
        source: "/en/4262985/:path*",
        destination: "/penn-estates",
        permanent: true,
      },
      {
        source: "/en/4264320/:path*",
        destination: "/blue-mountain-lake",
        permanent: true,
      },
      {
        source: "/en/2579480/:path*",
        destination: "/east-stroudsburg-restaurants",
        permanent: true,
      },
      {
        source: "/en/2450460/:path*",
        destination: "/things-to-do",
        permanent: true,
      },
      {
        source: "/en/2450458/:path*",
        destination: "/things-to-do",
        permanent: true,
      },
      {
        source: "/en/2450447/:path*",
        destination: "/things-to-do",
        permanent: true,
      },
      {
        source: "/en/2450462/:path*",
        destination: "/penn-estates",
        permanent: true,
      },
      {
        source: "/en/2450324/:path*",
        destination: "/search",
        permanent: true,
      },
      {
        source: "/en/4279949/:path*",
        destination: "/search",
        permanent: true,
      },
      {
        source: "/en/2450455/:path*",
        destination: "/rental-policies",
        permanent: true,
      },
      {
        source: "/en/2183836/:path*",
        destination: "/rental-policies",
        permanent: true,
      },
      {
        source: "/en/4097004/:path*",
        destination: "/book/luxury-lakefront-chalet-in-poconos-1-5hrs-from-nyc",
        permanent: true,
      },
      {
        source: "/en/4097003/:path*",
        destination: "/book/poconos-lakefront-with-hot-tub-boats-and-more",
        permanent: true,
      },
      {
        source: "/en/2550800/:path*",
        destination: "/book/cozy-lakefront-home-w-game-room-hot-tub-fire-pit-boats",
        permanent: true,
      },
      {
        source: "/en/2450327/:path*",
        destination: "/book/lake-adjacent-home-w-hot-tub-game-room-boats-fenced-yard",
        permanent: true,
      },
      {
        source: "/en/2450325/:path*",
        destination: "/book/poconos-lakefront-with-hot-tub-boats-and-more",
        permanent: true,
      },
      {
        source: "/listing/:path*",
        destination: "/search",
        permanent: true,
      },
      {
        source: "/en/2551487/:path*",
        destination: "/book/lakefront-mansion-w-3-decks-hot-tub-boats-game-room",
        permanent: true,
      },
      {
        source: "/en/2450326/:path*",
        destination: "/book/luxury-lakefront-chalet-in-poconos-1-5hrs-from-nyc",
        permanent: true,
      },
      {
        source: "/en/the-summit-lakehouse",
        destination: "/book/poconos-lakefront-with-hot-tub-boats-and-more",
        permanent: true,
      },
      {
        source: "/en/all-properties",
        destination: "/search",
        permanent: true,
      },
      {
        source: "/en/mountainbiking",
        destination: "/things-to-do",
        permanent: true,
      },
      {
        source: "/en/:path*",
        destination: "/",
        permanent: true,
      },
      // --- Retired duplicate listings (same physical houses under old names).
      // These slugs hard-404 today because getPropertyDetails filters on
      // is_active; send them to their active twin instead.
      {
        source: "/book/lakefront-home-w-hot-tub-game-room-deck-boats-fire-pit",
        destination: "/book/poconos-lakefront-with-hot-tub-boats-and-more",
        permanent: true,
      },
      {
        source: "/book/lakeview-chalet-w-hot-tub-sauna-decks-boats-fire-pit",
        destination: "/book/luxury-lakefront-chalet-in-poconos-1-5hrs-from-nyc",
        permanent: true,
      },
      {
        source: "/book/large-stylish-home-right-next-to-train-station",
        destination: "/search",
        permanent: true,
      },
    ];
  },
  serverExternalPackages: ["pdfkit"],
  outputFileTracingIncludes: {
    "/api/pepoa/*": ["./node_modules/pdfkit/js/data/**/*", "./public/pepoa-header.png", "./public/BML-logo.png"],
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" },
    ],
  },
};

export default nextConfig;
