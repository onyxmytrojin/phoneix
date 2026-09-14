import type { MetadataRoute } from "next";

// Required for `output: "export"` — see robots.ts for why.
export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://shubhanmehrotra.com";
  return [
    { url: base, changeFrequency: "monthly", priority: 1 },
    { url: `${base}/server`, changeFrequency: "daily", priority: 0.7 },
    { url: `${base}/cluster`, changeFrequency: "daily", priority: 0.7 },
    { url: `${base}/privacy`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${base}/terms`, changeFrequency: "yearly", priority: 0.2 },
  ];
}
