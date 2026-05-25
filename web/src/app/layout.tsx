import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"], display: "swap" });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
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
      <body>{children}</body>
    </html>
  );
}
