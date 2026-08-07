import type { Metadata } from "next";

// Payment pages render real registration/balance data by UUID — never index.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function PayLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
