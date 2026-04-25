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
