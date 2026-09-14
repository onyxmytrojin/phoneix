import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"], display: "swap" });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL("https://shubhanmehrotra.com"),
  title: "Shubhan Mehrotra",
  description: "Software Engineer from India. Building Phoneix — a self-hosted API, dashboard, and distributed cache on a Pixel 7a.",
  openGraph: {
    title: "Shubhan Mehrotra",
    description: "Software Engineer · Entrupy. FastAPI · Go · Distributed Systems.",
    url: "https://shubhanmehrotra.com",
    siteName: "shubhanmehrotra.com",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <head>
        {/* Plausible — privacy-friendly analytics, no cookie banner needed.
            Records nothing until "shubhanmehrotra.com" is added as a site
            in the Plausible account at plausible.io; the script itself is
            harmless to ship ahead of that. */}
        <script defer data-domain="shubhanmehrotra.com" src="https://plausible.io/js/script.js"></script>
      </head>
      <body>{children}</body>
    </html>
  );
}
