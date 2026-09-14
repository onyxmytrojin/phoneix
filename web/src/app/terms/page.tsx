import type { Metadata } from "next";
import Link from "next/link";
import MainNav from "@/components/MainNav";
import WaveBackground from "@/components/WaveBackground";

export const metadata: Metadata = {
  title: "Terms & Conditions — Shubhan Mehrotra",
  description: "Terms of use for shubhanmehrotra.com.",
};

const H2 = { fontSize: "18px", fontWeight: 700, color: "#fff", margin: "28px 0 10px" };
const P = { fontSize: "14px", color: "rgba(255,255,255,0.8)", lineHeight: 1.7, marginBottom: "10px" };
const LI = { fontSize: "14px", color: "rgba(255,255,255,0.8)", lineHeight: 1.7, marginBottom: "6px" };

export default function TermsPage() {
  return (
    <>
      <MainNav />
      <WaveBackground className="wave-bg-fixed" />
      <div style={{ maxWidth: "720px", margin: "0 auto", padding: "120px 24px 80px", color: "#fff" }}>
        <Link href="/" style={{ fontSize: "13px", color: "rgba(255,255,255,0.6)" }}>&larr; Back home</Link>
        <h1 style={{ fontSize: "clamp(28px,5vw,38px)", fontWeight: 800, margin: "16px 0 6px", letterSpacing: "-0.02em" }}>Terms &amp; Conditions</h1>
        <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.55)", marginBottom: "8px" }}>Last updated: September 2026</p>

        <p style={P}>
          This is a personal portfolio site. These terms are here mainly because they should be, not because
          there&apos;s much to actually govern — by using this site you&apos;re agreeing to the following.
        </p>

        <h2 style={H2}>Content</h2>
        <p style={P}>
          The text, design, and project write-ups on this site are my own and represent my own work and experience.
          Code linked from GitHub repositories is covered by whatever license is declared in that repository, not by
          this page. You&apos;re welcome to reference or link to this site; please don&apos;t reproduce the content
          wholesale as your own.
        </p>

        <h2 style={H2}>The live demos</h2>
        <p style={P}>
          The /server and /cluster pages show a real personal server (a phone running a self-hosted API and cache
          cluster) for demonstration purposes. It&apos;s a hobby project, not a production service — uptime,
          availability, and response times aren&apos;t guaranteed, and I reserve the right to take it offline,
          change it, or reset it at any time without notice.
        </p>

        <h2 style={H2}>Acceptable use</h2>
        <ul style={{ paddingLeft: "20px", margin: "0 0 10px" }}>
          <li style={LI}>Don&apos;t attempt to overload, abuse, or exploit the public API endpoints linked from this site.</li>
          <li style={LI}>Don&apos;t attempt to gain unauthorized access to the underlying server, its data, or its infrastructure.</li>
        </ul>

        <h2 style={H2}>External links</h2>
        <p style={P}>
          Links to GitHub, LinkedIn, project demos, and other third-party sites are provided for convenience. I
          don&apos;t control and am not responsible for the content or practices of those external sites.
        </p>

        <h2 style={H2}>No warranty</h2>
        <p style={P}>
          This site and everything on it is provided &quot;as is,&quot; without warranty of any kind, express or
          implied.
        </p>

        <h2 style={H2}>Changes</h2>
        <p style={P}>
          These terms may be updated at any time; continued use of the site after a change means you accept the
          updated terms.
        </p>

        <h2 style={H2}>Contact</h2>
        <p style={P}>
          Questions? Reach out at{" "}
          <a href="mailto:shubhanmehrotra@gmail.com" style={{ color: "#f4a261" }}>shubhanmehrotra@gmail.com</a>.
        </p>
      </div>
    </>
  );
}
