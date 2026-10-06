import type { Metadata } from "next";
import "@fontsource-variable/inter";
import "@fontsource/noto-sans-jp/400.css";
import "@fontsource/noto-sans-jp/600.css";
import "./globals.css";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: {
    default: "Prorium | Investor Relations",
    template: "%s | Prorium IR",
  },
  description: "Prorium Monthly Shareholder Report · Investor Relations",
  robots: { index: false, follow: false },
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja" data-scroll-behavior="smooth">
      <body>{children}</body>
    </html>
  );
}
