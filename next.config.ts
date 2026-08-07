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
