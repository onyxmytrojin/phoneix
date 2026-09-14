import type { MetadataRoute } from "next";

// Required for `output: "export"` — without this, Next tries to treat
// robots.txt as dynamically rendered, which a static export can't do.
export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: "https://shubhanmehrotra.com/sitemap.xml",
  };
}
