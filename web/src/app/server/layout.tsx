import type { Metadata } from "next";

// ServerPage itself is a client component ("use client", for live data
// fetching), so metadata can't be exported from it directly — Next.js only
// reads metadata exports from server components. This layout wrapper is
// the standard workaround: a server component that owns the route's
// metadata and just passes children through untouched.
export const metadata: Metadata = {
  title: "Server Dashboard — Shubhan Mehrotra",
  description: "Live dashboard for Phoneix — uptime, response times, and request activity for a self-hosted API and dashboard running on a Pixel 7a.",
};

export default function ServerLayout({ children }: { children: React.ReactNode }) {
  return children;
}
