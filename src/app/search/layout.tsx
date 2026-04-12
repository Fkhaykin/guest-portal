import { Plus_Jakarta_Sans } from "next/font/google";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-plus-jakarta",
});

export default function SearchLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={`${plusJakarta.variable} font-(family-name:--font-plus-jakarta)`}>
      {children}
    </div>
  );
}
