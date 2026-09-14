import Link from "next/link";
import MainNav from "@/components/MainNav";
import WaveBackground from "@/components/WaveBackground";

export default function NotFound() {
  return (
    <>
      <MainNav />
      <WaveBackground className="fixed inset-0 -z-10" />
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          padding: "24px",
          color: "#fff",
        }}
      >
        <div style={{ fontSize: "clamp(64px,14vw,120px)", fontWeight: 800, lineHeight: 1, letterSpacing: "-0.03em" }}>404</div>
        <p style={{ fontSize: "16px", color: "rgba(255,255,255,0.8)", marginTop: "12px", marginBottom: "28px" }}>
          This page doesn&apos;t exist — or wandered off somewhere.
        </p>
        <Link
          href="/"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            background: "#1b1f24",
            color: "#fff",
            fontWeight: 600,
            fontSize: "14px",
            padding: "10px 22px",
            borderRadius: "8px",
            textDecoration: "none",
          }}
        >
          Back home
        </Link>
      </div>
    </>
  );
}
