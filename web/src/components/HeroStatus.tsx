"use client";
import { useEffect, useState } from "react";

const API = "https://api.shubhanmehrotra.com";

export default function HeroStatus() {
  const [cpu, setCpu] = useState<number | null>(null);
  const [uptime, setUptime] = useState<string | null>(null);

  useEffect(() => {
    async function check() {
      try {
        const res = await fetch(`${API}/v1/server`);
        if (!res.ok) return;
        const d = await res.json();
        if (typeof d?.cpu_percent === "number") setCpu(d.cpu_percent);
        if (d?.uptime_human) setUptime(d.uptime_human);
      } catch {}
    }
    check();
    const id = setInterval(check, 30000);
    return () => clearInterval(id);
  }, []);

  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "10px 18px", background: "#0d0d14", border: "1px solid #1a1a28",
      borderRadius: "10px", fontSize: "13px", color: "#6b7280",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 6px #22c55e", flexShrink: 0 }} />
        <span>
          Google Pixel 7a · ARM64
          {cpu !== null && <> · CPU <span style={{ color: "#e8eaf0" }}>{cpu.toFixed(1)}%</span></>}
          {uptime && <> · Uptime <span style={{ color: "#e8eaf0" }}>{uptime}</span></>}
        </span>
      </div>
      <a href="/server" style={{ color: "#4c8ef7", fontSize: "12px", whiteSpace: "nowrap" }}>View server dashboard →</a>
    </div>
  );
}
