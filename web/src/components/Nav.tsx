"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const NAV_LINKS = [
  { href: "/#home",       label: "Home" },
  { href: "/#experience", label: "Experience" },
  { href: "/#projects",   label: "Projects" },
  { href: "/#skills",     label: "Skills" },
  { href: "/#contact",    label: "Contact" },
];

export default function Nav() {
  const [online, setOnline] = useState<boolean | null>(null);
  const [memMb, setMemMb] = useState<number | null>(null);
  const [showMem, setShowMem] = useState(false);

  useEffect(() => {
    async function check() {
      try {
        const [pingRes, srvRes] = await Promise.all([
          fetch("https://api.shubhanmehrotra.com/v1/ping"),
          fetch("https://api.shubhanmehrotra.com/v1/server"),
        ]);
        setOnline(pingRes.ok);
        if (srvRes.ok) {
          const d = await srvRes.json();
          if (d?.memory?.used_gb != null) setMemMb(Math.round(d.memory.used_gb * 1024));
        }
      } catch {
        setOnline(false);
      }
    }
    check();
    const id = setInterval(check, 30000);
    return () => clearInterval(id);
  }, []);

  return (
    <nav style={{
      position: "sticky", top: 0, zIndex: 50,
      display: "flex", alignItems: "center",
      padding: "0 32px", height: "52px",
      background: "rgba(6,6,9,0.85)",
      backdropFilter: "blur(10px)",
      borderBottom: "1px solid #1a1a28",
    }}>
      <div style={{ display: "flex", gap: "28px", flex: 1 }}>
        {NAV_LINKS.map(l => (
          <Link key={l.href} href={l.href} className="nav-link">{l.label}</Link>
        ))}
        <Link href="/server" className="nav-server">
          Server <span style={{ fontSize: "11px" }}>↗</span>
        </Link>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        {/* Server status pill */}
        <div style={{ position: "relative" }}
          onMouseEnter={() => setShowMem(true)}
          onMouseLeave={() => setShowMem(false)}
        >
          <div style={{
            display: "flex", alignItems: "center", gap: "6px",
            padding: "4px 12px", borderRadius: "20px",
            background: online === true ? "rgba(34,197,94,0.12)" : online === false ? "rgba(239,68,68,0.12)" : "rgba(100,116,139,0.12)",
            border: `1px solid ${online === true ? "rgba(34,197,94,0.3)" : online === false ? "rgba(239,68,68,0.3)" : "rgba(100,116,139,0.3)"}`,
            cursor: "default",
          }}>
            <span style={{
              width: "7px", height: "7px", borderRadius: "50%",
              background: online === true ? "#22c55e" : online === false ? "#ef4444" : "#64748b",
              boxShadow: online === true ? "0 0 6px #22c55e" : "none",
            }} />
            <span style={{ fontSize: "12px", fontWeight: 500, color: online === true ? "#22c55e" : online === false ? "#ef4444" : "#64748b" }}>
              {online === null ? "Checking…" : online ? "Server online" : "Server offline"}
            </span>
          </div>
          {showMem && memMb !== null && (
            <div style={{
              position: "absolute", top: "calc(100% + 8px)", right: 0,
              background: "#0f1117", border: "1px solid #1e2030", borderRadius: "8px",
              padding: "8px 12px", fontSize: "12px", color: "#9aa3b8", whiteSpace: "nowrap",
              boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
            }}>
              💾 Memory usage: {memMb} MB
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
