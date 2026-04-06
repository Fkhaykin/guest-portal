import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdfkit"],
  outputFileTracingIncludes: {
    "/api/pepoa/*": ["./node_modules/pdfkit/js/data/**/*"],
  },
};

export default nextConfig;
