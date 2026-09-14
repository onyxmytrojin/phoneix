import type { Metadata } from "next";
import Link from "next/link";
import MainNav from "@/components/MainNav";
import WaveBackground from "@/components/WaveBackground";

export const metadata: Metadata = {
  title: "Privacy Policy — Shubhan Mehrotra",
  description: "How shubhanmehrotra.com handles visitor data.",
};

const H2 = { fontSize: "18px", fontWeight: 700, color: "#fff", margin: "28px 0 10px" };
const P = { fontSize: "14px", color: "rgba(255,255,255,0.8)", lineHeight: 1.7, marginBottom: "10px" };
const LI = { fontSize: "14px", color: "rgba(255,255,255,0.8)", lineHeight: 1.7, marginBottom: "6px" };

export default function PrivacyPage() {
  return (
    <>
      <MainNav />
      <WaveBackground className="wave-bg-fixed" />
      <div style={{ maxWidth: "720px", margin: "0 auto", padding: "120px 24px 80px", color: "#fff" }}>
        <Link href="/" style={{ fontSize: "13px", color: "rgba(255,255,255,0.6)" }}>&larr; Back home</Link>
        <h1 style={{ fontSize: "clamp(28px,5vw,38px)", fontWeight: 800, margin: "16px 0 6px", letterSpacing: "-0.02em" }}>Privacy Policy</h1>
        <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.55)", marginBottom: "8px" }}>Last updated: September 2026</p>

        <p style={P}>
          This is a personal portfolio site. It doesn&apos;t have user accounts, doesn&apos;t run any forms that collect
          personal information, and doesn&apos;t sell or share data with anyone. Here&apos;s exactly what does happen
          when you visit.
        </p>

        <h2 style={H2}>Analytics</h2>
        <p style={P}>
          This site uses <a href="https://plausible.io" target="_blank" rel="noreferrer" style={{ color: "#f4a261" }}>Plausible Analytics</a>,
          a privacy-focused analytics tool that doesn&apos;t use cookies or any persistent identifier, and doesn&apos;t
          collect or store any personal data about you. It counts page views and reports aggregated, anonymized
          statistics (page, referrer, approximate country, device type) — there&apos;s no way for anyone, including me,
          to tie a page view back to a specific person.
        </p>

        <h2 style={H2}>Cookies</h2>
        <p style={P}>
          This site does not set any cookies of its own. The CDN in front of it (Cloudflare) may set a small number
          of strictly-necessary cookies for routing traffic securely and protecting against abuse — these aren&apos;t
          used for tracking or advertising and are exempt from consent requirements under GDPR/ePrivacy for exactly
          that reason.
        </p>

        <h2 style={H2}>Third-party services</h2>
        <ul style={{ paddingLeft: "20px", margin: "0 0 10px" }}>
          <li style={LI}><strong>Plausible Analytics</strong> — anonymized traffic analytics (see above).</li>
          <li style={LI}><strong>GitHub API</strong> — this site fetches my own public GitHub activity client-side to display on the page; it doesn&apos;t send any data about you to GitHub.</li>
          <li style={LI}><strong>Cloudflare</strong> — CDN and security layer in front of the site.</li>
        </ul>

        <h2 style={H2}>The live dashboards (/server, /cluster)</h2>
        <p style={P}>
          These pages show live operational metrics (CPU, memory, request logs, cache-node status) from my own
          personal server. Request logs shown there include the path and method of requests made to that API, which
          may include your IP address as part of standard server logging — this is used only for the live &quot;recent
          requests&quot; display and basic abuse protection, never sold, shared, or used for tracking.
        </p>

        <h2 style={H2}>Questions</h2>
        <p style={P}>
          Reach out at{" "}
          <a href="mailto:shubhanmehrotra@gmail.com" style={{ color: "#f4a261" }}>shubhanmehrotra@gmail.com</a>
          {" "}with any privacy questions.
        </p>
      </div>
    </>
  );
}
