"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { API, fmtUp } from "@/lib/utils";

const DASH_PATHS = new Set(["/v1/server","/v1/logs","/v1/cluster","/v1/cluster/keys",
  "/v1/ping","/v1/response-times","/v1/availability","/v1/visitors"]);

type LogEntry = { method?: string; path?: string; status?: number; duration_ms?: number; timestamp?: string };
type NodeData  = { node_id?: string; id?: string; status?: string; port?: number; keys_held?: number; uptime_seconds?: number; requests_total?: number; peer_states?: Record<string,string> };
type SrvData   = { uptime_human?: string; cpu_percent?: number; memory?: { used_gb: number; total_gb: number; percent_used: number }; disk?: { free_gb: number; total_gb: number }; load_avg?: number[] };
type AvailDay  = { date: string; status: string; uptime_percent: number; requests?: number; errors?: number };
type AvailData = { days?: AvailDay[]; summary?: { last_30_days?: number; last_90_days?: number } };
type RespData  = { endpoints?: Record<string, { p50?: number; count?: number }> };
type ClusterData = { nodes?: NodeData[]; summary?: { alive?: number; total?: number; total_keys?: number } };
type ApiOut = { open: boolean; loading: boolean; data: string | null };

function timeAgo(iso: string) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60)    return `${Math.round(s)}s ago`;
  if (s < 3600)  return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
}

const STATUS_COLOR = {
  incident: "#da3633",
  degraded: "#f59e0b",
  no_data:  "#1a2a1a",
  healthy:  "#39d353",
} as const;

function uptimeColor(d: AvailDay) {
  if (d.status === "no_data")  return STATUS_COLOR.no_data;
  if (d.status === "incident") return STATUS_COLOR.incident;
  if (d.status === "degraded") return STATUS_COLOR.degraded;
  const p = d.uptime_percent;
  return p === 100 ? "#39d353" : p >= 95 ? "#26a641" : p >= 80 ? "#006d32" : "#0e4429";
}

function buildWeekGrid(days: AvailDay[]) {
  if (!days.length) return { weeks: [] as (AvailDay | null)[][], months: [] as {label:string;col:number}[] };
  const firstDow = new Date(days[0].date + "T12:00:00Z").getUTCDay();
  const cells: (AvailDay | null)[] = [...Array(firstDow).fill(null), ...days];
  while (cells.length % 7) cells.push(null);
  const weeks: (AvailDay | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  const months: { label: string; col: number }[] = [];
  let last = "";
  weeks.forEach((wk, col) => {
    const first = wk.find(d => d !== null);
    if (!first) return;
    const m = first.date.slice(0, 7);
    if (m !== last) {
      months.push({ label: new Date(first.date + "T12:00:00Z").toLocaleString("default", { month: "short" }), col });
      last = m;
    }
  });
  return { weeks, months };
}

const API_GROUPS = [
  { label: "CORE", items: [
    { m: "GET",  p: "/v1/ping",    d: "Health check" },
    { m: "GET",  p: "/v1/health",  d: "Detailed health" },
    { m: "GET",  p: "/v1/now",     d: "Currently building" },
  ]},
  { label: "CACHE", items: [
    { m: "GET",  p: "/v1/cluster",          d: "Cache cluster status" },
    { m: "POST", p: "/v1/cluster/rebalance", d: "Trigger key rebalancing" },
  ]},
  { label: "SERVER", items: [
    { m: "GET", p: "/v1/server",         d: "CPU, RAM, disk, uptime" },
    { m: "GET", p: "/v1/metrics",        d: "Prometheus-format metrics" },
    { m: "GET", p: "/v1/response-times", d: "Per-endpoint latency" },
    { m: "GET", p: "/v1/availability",   d: "30-day uptime history" },
    { m: "GET", p: "/v1/logs",           d: "Recent request log" },
    { m: "GET", p: "/v1/visitors",       d: "Unique visitor count" },
  ]},
  { label: "PROFILE", items: [
    { m: "GET", p: "/v1/cv",     d: "Resume as JSON" },
    { m: "GET", p: "/v1/github", d: "GitHub activity" },
    { m: "GET", p: "/v1/uses",   d: "Tools & setup" },
    { m: "GET", p: "/v1/stack",  d: "Tech stack" },
  ]},
];

export default function ServerPage() {
  const [srv,       setSrv]      = useState<SrvData | null>(null);
  const [avail,     setAvail]    = useState<AvailData | null>(null);
  const [resp,      setResp]     = useState<RespData | null>(null);
  const [cluster,   setCluster]  = useState<ClusterData | null>(null);
  const [logs,      setLogs]     = useState<LogEntry[]>([]);
  const [apiOuts,   setApiOuts]  = useState<Record<string, ApiOut>>({});
  const [uptimeDays, setUptimeDays] = useState(90);
  const [selDay,    setSelDay]   = useState<AvailDay | null>(null);

  useEffect(() => {
    const ac = new AbortController();
    const { signal } = ac;

    async function fast() {
      const [s, l] = await Promise.all([
        fetch(`${API}/v1/server`, { signal }).then(r => r.json()).catch(() => null),
        fetch(`${API}/v1/logs`,   { signal }).then(r => r.json()).catch(() => null),
      ]);
      if (s) setSrv(s);
      if (l?.logs) {
        const all: LogEntry[] = l.logs;
        const ext = all.filter(r => r.path && !DASH_PATHS.has(r.path));
        setLogs((ext.length > 0 ? [...ext].reverse() : [...all].reverse()).slice(0, 25));
      }
    }
    async function slow() {
      const [a, r, c] = await Promise.all([
        fetch(`${API}/v1/availability`,    { signal }).then(x => x.json()).catch(() => null),
        fetch(`${API}/v1/response-times`,  { signal }).then(x => x.json()).catch(() => null),
        fetch(`${API}/v1/cluster`,         { signal }).then(x => x.json()).catch(() => null),
      ]);
      if (a) setAvail(a);
      if (r) setResp(r);
      if (c) setCluster(c);
    }
    fast(); slow();
    const fi = setInterval(fast, 5000);
    const si = setInterval(slow, 15000);
    return () => { ac.abort(); clearInterval(fi); clearInterval(si); };
  }, []);

  async function tryEndpoint(path: string, method = "GET") {
    setApiOuts(p => ({ ...p, [path]: { open: true, loading: true, data: null } }));
    try {
      const r = await fetch(`${API}${path}`, method === "POST" ? { method: "POST" } : {});
      const text = await r.text();
      let out = text;
      try { out = JSON.stringify(JSON.parse(text), null, 2); } catch {}
      setApiOuts(p => ({ ...p, [path]: { open: true, loading: false, data: out } }));
    } catch {
      setApiOuts(p => ({ ...p, [path]: { open: true, loading: false, data: "// request failed" } }));
    }
  }

  function toggleOut(path: string) {
    setApiOuts(p => ({ ...p, [path]: p[path] ? { ...p[path], open: !p[path].open } : { open: false, loading: false, data: null } }));
  }

  const cpu      = srv?.cpu_percent ?? 0;
  const memUsed  = srv?.memory?.used_gb ?? 0;
  const memTotal = srv?.memory?.total_gb ?? 0;
  const memPct   = srv?.memory?.percent_used ?? 0;
  const diskFree = srv?.disk?.free_gb ?? 0;
  const diskTot  = srv?.disk?.total_gb ?? 0;
  const diskPct  = diskTot > 0 ? ((diskTot - diskFree) / diskTot) * 100 : 0;
  const load     = srv?.load_avg ?? [0, 0, 0];

  const respRows = useMemo(() =>
    resp?.endpoints
      ? Object.entries(resp.endpoints)
          .map(([path, s]) => ({ path, avg: s.p50 ?? 0, count: s.count ?? 0 }))
          .filter(e => e.path.startsWith("/v1/"))
          .sort((a, b) => b.count - a.count)
          .slice(0, 9)
      : [],
    [resp]
  );
  const maxAvg = useMemo(() => Math.max(...respRows.map(e => e.avg), 1), [respRows]);

  const BAR = (pct: number, color: string) => (
    <div style={{ height: "4px", background: "#1a1a28", borderRadius: "2px", overflow: "hidden", margin: "8px 0 6px" }}>
      <div style={{ height: "100%", width: `${Math.min(100, pct)}%`, background: color, borderRadius: "2px", transition: "width 0.5s" }} />
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#060609", color: "#e8eaf0" }}>

      {/* ── Nav ── */}
      <nav style={{
        position: "sticky", top: 0, zIndex: 50,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 24px", height: "48px",
        background: "rgba(6,6,9,0.92)", backdropFilter: "blur(10px)",
        borderBottom: "1px solid #1a1a28", fontSize: "13px",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#6b7280" }}>
          <Link href="/" style={{ color: "#4c8ef7", textDecoration: "none" }}>← Shubhan Mehrotra</Link>
          <span>/</span>
          <span style={{ color: "#e8eaf0" }}>Server</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          <Link href="/cluster" style={{ color: "#6b7280", fontSize: "12px", textDecoration: "none" }}>Cache Cluster →</Link>
          <a href="https://api.shubhanmehrotra.com/docs" target="_blank" rel="noreferrer" style={{ color: "#4c8ef7", fontSize: "12px" }}>API Docs ↗</a>
        </div>
      </nav>

      {/* ── Hero ── */}
      <div style={{
        background: "#07070d",
        backgroundImage: "linear-gradient(rgba(76,142,247,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(76,142,247,0.025) 1px, transparent 1px)",
        backgroundSize: "32px 32px",
        borderBottom: "1px solid #1a1a28",
      }}>
        <div style={{ maxWidth: "960px", margin: "0 auto", padding: "40px 24px 36px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "32px", flexWrap: "wrap" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
              <span style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "12px", color: "#22c55e", background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.25)", borderRadius: "20px", padding: "3px 10px", fontWeight: 600 }}>
                <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 6px #22c55e" }} /> Live
              </span>
              <span style={{ fontSize: "13px", color: "#6b7280" }}>Bangalore, India</span>
            </div>
            <h1 style={{ fontSize: "clamp(26px,5vw,40px)", fontWeight: 800, lineHeight: 1.1, marginBottom: "10px", letterSpacing: "-0.02em" }}>
              Phoneix <span style={{ color: "#4c8ef7" }}>Server</span>
            </h1>
            <p style={{ fontSize: "13px", color: "#4c8ef7", marginBottom: "10px", fontFamily: "var(--font-geist-mono), monospace" }}>
              Google Pixel 7a · ARM64 · Debian (proot) · GrapheneOS
            </p>
            <p style={{ fontSize: "14px", color: "#6b7280", maxWidth: "420px", lineHeight: 1.65 }}>
              This page is served from a phone in my room. Every number below is pulled live from the hardware running it.
            </p>
          </div>
          <div style={{ background: "#0d0d14", border: "1px solid #1a1a28", borderRadius: "10px", padding: "20px 28px", textAlign: "center", flexShrink: 0 }}>
            <div style={{ fontSize: "10px", color: "#6b7280", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "8px" }}>Uptime</div>
            <div style={{ fontSize: "32px", fontWeight: 800, lineHeight: 1 }}>{srv?.uptime_human ?? "—"}</div>
            <div style={{ fontSize: "11px", color: "#363650", marginTop: "8px" }}>since last restart</div>
          </div>
        </div>
      </div>

      {/* ── Main ── */}
      <div style={{ maxWidth: "960px", margin: "0 auto", padding: "24px", display: "flex", flexDirection: "column", gap: "16px" }}>

        {/* Stats row */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px" }}>
          {/* CPU */}
          <div style={{ background: "#0d0d14", border: "1px solid #1a1a28", borderRadius: "10px", padding: "16px 18px" }}>
            <div style={{ fontSize: "11px", color: "#6b7280", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: "6px" }}>CPU</div>
            <div style={{ fontSize: "28px", fontWeight: 800, lineHeight: 1.1 }}>{cpu.toFixed(1)}%</div>
            {BAR(cpu, cpu > 85 ? "#ef4444" : cpu > 65 ? "#f59e0b" : "#4c8ef7")}
            <div style={{ fontSize: "11px", color: "#363650" }}>sched_pixel · load/freq blend</div>
          </div>
          {/* Memory */}
          <div style={{ background: "#0d0d14", border: "1px solid #1a1a28", borderRadius: "10px", padding: "16px 18px" }}>
            <div style={{ fontSize: "11px", color: "#6b7280", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: "6px" }}>Memory</div>
            <div style={{ fontSize: "28px", fontWeight: 800, lineHeight: 1.1 }}>{memUsed.toFixed(1)} GB</div>
            {BAR(memPct, memPct > 85 ? "#ef4444" : "#f59e0b")}
            <div style={{ fontSize: "11px", color: "#363650" }}>of {memTotal.toFixed(1)} GB</div>
          </div>
          {/* Disk */}
          <div style={{ background: "#0d0d14", border: "1px solid #1a1a28", borderRadius: "10px", padding: "16px 18px" }}>
            <div style={{ fontSize: "11px", color: "#6b7280", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: "6px" }}>Disk Free</div>
            <div style={{ fontSize: "28px", fontWeight: 800, lineHeight: 1.1 }}>{diskFree.toFixed(0)} GB</div>
            {BAR(diskPct, diskPct > 85 ? "#ef4444" : "#22c55e")}
            <div style={{ fontSize: "11px", color: "#363650" }}>of {diskTot.toFixed(0)} GB total</div>
          </div>
          {/* Load */}
          <div style={{ background: "#0d0d14", border: "1px solid #1a1a28", borderRadius: "10px", padding: "16px 18px" }}>
            <div style={{ fontSize: "11px", color: "#6b7280", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: "6px" }}>Load Avg</div>
            <div style={{ fontSize: "28px", fontWeight: 800, lineHeight: 1.1 }}>{(load[0] ?? 0).toFixed(2)}</div>
            <div style={{ display: "flex", gap: "6px", marginTop: "16px" }}>
              {load.slice(0, 3).map((v, i) => (
                <span key={i} style={{ fontSize: "11px", color: "#6b7280", background: "#1a1a28", borderRadius: "4px", padding: "2px 6px", fontFamily: "var(--font-geist-mono), monospace", fontVariantNumeric: "tabular-nums" }}>{(v ?? 0).toFixed(2)}</span>
              ))}
            </div>
          </div>
        </div>

        {/* Two-column: uptime | response times */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
          {/* 30-day uptime */}
          <div style={{ background: "#0d0d14", border: "1px solid #1a1a28", borderRadius: "10px", padding: "18px 20px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
              <span style={{ fontSize: "13px", fontWeight: 600 }}>{uptimeDays}-Day Uptime</span>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <div style={{ display: "flex", gap: "3px" }}>
                  {[30, 60, 90].map(d => (
                    <button key={d} onClick={() => { setUptimeDays(d); setSelDay(null); }} style={{
                      padding: "2px 8px", fontSize: "10px", borderRadius: "4px", border: "none",
                      cursor: "pointer", fontFamily: "inherit", letterSpacing: "0.04em",
                      background: uptimeDays === d ? "#4c8ef7" : "#1a1a28",
                      color: uptimeDays === d ? "#fff" : "#6b7280",
                      transition: "background 0.15s",
                    }}>{d}d</button>
                  ))}
                </div>
                {(avail?.summary?.last_90_days ?? avail?.summary?.last_30_days) != null && (
                  <span style={{ fontSize: "11px", color: "#22c55e", background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: "4px", padding: "2px 8px" }}>
                    {avail!.summary!.last_90_days ?? avail!.summary!.last_30_days}% avg
                  </span>
                )}
              </div>
            </div>
            {(() => {
              if (!avail?.days) return <div style={{ height: "88px" }} />;
              const gridDays = avail.days.slice(-uptimeDays);
              const { weeks, months } = buildWeekGrid(gridDays);
              const SZ = 10, GAP = 3;
              const statusLabel = (d: AvailDay) => d.status === "no_data" ? "No data" : d.status.charAt(0).toUpperCase() + d.status.slice(1);
              const statusColor = (d: AvailDay) => d.status === "no_data" ? "#6b7280" : STATUS_COLOR[d.status as keyof typeof STATUS_COLOR] ?? "#22c55e";
              return (
                <div style={{ overflowX: "auto" }}>
                  {/* Month labels */}
                  <div style={{ display: "flex", marginLeft: "20px", marginBottom: "4px", position: "relative", height: "13px" }}>
                    {months.map(m => (
                      <div key={m.col} style={{ position: "absolute", left: `${m.col * (SZ + GAP)}px`, fontSize: "9px", color: "#6b7280", whiteSpace: "nowrap", letterSpacing: "0.04em" }}>{m.label}</div>
                    ))}
                  </div>
                  <div style={{ display: "flex", gap: `${GAP}px` }}>
                    {/* Day-of-week labels */}
                    <div style={{ display: "flex", flexDirection: "column", gap: `${GAP}px`, paddingTop: "1px" }}>
                      {["","M","","W","","F",""].map((l, i) => (
                        <div key={i} style={{ width: "13px", height: `${SZ}px`, fontSize: "9px", color: "#6b7280", lineHeight: `${SZ}px`, textAlign: "right" }}>{l}</div>
                      ))}
                    </div>
                    {/* Week columns */}
                    {weeks.map((wk, wi) => (
                      <div key={wi} style={{ display: "flex", flexDirection: "column", gap: `${GAP}px` }}>
                        {wk.map((day, di) => (
                          <div key={di}
                            onClick={() => day && setSelDay(selDay?.date === day.date ? null : day)}
                            style={{
                              width: `${SZ}px`, height: `${SZ}px`, borderRadius: "2px",
                              background: day ? uptimeColor(day) : "transparent",
                              cursor: day ? "pointer" : "default",
                              outline: day && selDay?.date === day.date ? "2px solid #e8eaf0" : "none",
                              outlineOffset: "1px",
                            }} />
                        ))}
                      </div>
                    ))}
                  </div>

                  {/* Selected day popover */}
                  {selDay && (
                    <div style={{ marginTop: "10px", padding: "10px 14px", background: "#0a0a12", border: `1px solid ${statusColor(selDay)}40`, borderLeft: `3px solid ${statusColor(selDay)}`, borderRadius: "6px", fontSize: "12px", display: "flex", flexWrap: "wrap", gap: "14px", alignItems: "center" }}>
                      <div>
                        <div style={{ fontWeight: 600, marginBottom: "2px" }}>{new Date(selDay.date + "T12:00:00Z").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}</div>
                        <div style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "11px" }}>
                          <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: statusColor(selDay), flexShrink: 0 }} />
                          <span style={{ color: statusColor(selDay), fontWeight: 600, textTransform: "capitalize" }}>{statusLabel(selDay)}</span>
                        </div>
                      </div>
                      {selDay.status !== "no_data" && <>
                        <div style={{ textAlign: "center" }}>
                          <div style={{ fontSize: "18px", fontWeight: 700, color: "#e8eaf0", lineHeight: 1 }}>{selDay.uptime_percent}%</div>
                          <div style={{ fontSize: "10px", color: "#6b7280", letterSpacing: "0.06em", textTransform: "uppercase" }}>uptime</div>
                        </div>
                        <div style={{ textAlign: "center" }}>
                          <div style={{ fontSize: "18px", fontWeight: 700, color: "#e8eaf0", lineHeight: 1 }}>{(selDay.requests ?? 0).toLocaleString()}</div>
                          <div style={{ fontSize: "10px", color: "#6b7280", letterSpacing: "0.06em", textTransform: "uppercase" }}>requests</div>
                        </div>
                        <div style={{ textAlign: "center" }}>
                          <div style={{ fontSize: "18px", fontWeight: 700, color: (selDay.errors ?? 0) > 0 ? "#da3633" : "#e8eaf0", lineHeight: 1 }}>{(selDay.errors ?? 0).toLocaleString()}</div>
                          <div style={{ fontSize: "10px", color: "#6b7280", letterSpacing: "0.06em", textTransform: "uppercase" }}>errors</div>
                        </div>
                        {(selDay.requests ?? 0) > 0 && (selDay.errors ?? 0) === 0 && (
                          <div style={{ fontSize: "11px", color: "#6b7280" }}>No 5xx errors · all requests succeeded</div>
                        )}
                      </>}
                      {selDay.status === "no_data" && (
                        <div style={{ fontSize: "11px", color: "#6b7280" }}>Server was not running or no requests recorded on this day.</div>
                      )}
                    </div>
                  )}

                  {/* Legend */}
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "10px", fontSize: "10px", color: "#6b7280" }}>
                    <span>Less</span>
                    {(["#1a2a1a","#0e4429","#006d32","#26a641","#39d353"] as string[]).map(c => (
                      <div key={c} style={{ width: `${SZ}px`, height: `${SZ}px`, borderRadius: "2px", background: c, flexShrink: 0 }} />
                    ))}
                    <span>More</span>
                    <span style={{ marginLeft: "8px", display: "flex", alignItems: "center", gap: "4px" }}>
                      <div style={{ width: `${SZ}px`, height: `${SZ}px`, borderRadius: "2px", background: STATUS_COLOR.degraded }} /> Degraded
                    </span>
                    <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                      <div style={{ width: `${SZ}px`, height: `${SZ}px`, borderRadius: "2px", background: STATUS_COLOR.incident }} /> Incident
                    </span>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Response times */}
          <div style={{ background: "#0d0d14", border: "1px solid #1a1a28", borderRadius: "10px", padding: "18px 20px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
              <span style={{ fontSize: "13px", fontWeight: 600 }}>Response Times</span>
              <span style={{ fontSize: "11px", color: "#363650" }}>avg ms per endpoint</span>
            </div>
            {respRows.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "7px" }}>
                {respRows.map(e => {
                  const barPct = Math.max(1, Math.min(100, (e.avg / maxAvg) * 100));
                  const barColor = e.avg > 500 ? "#ef4444" : e.avg > 150 ? "#f59e0b" : "#4c8ef7";
                  return (
                    <div key={e.path} style={{ display: "grid", gridTemplateColumns: "130px 1fr 52px 42px", gap: "8px", alignItems: "center" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "5px", minWidth: 0 }}>
                        <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: barColor, flexShrink: 0 }} />
                        <code style={{ fontSize: "10px", color: "#6b7280", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.path}</code>
                      </div>
                      <div style={{ height: "4px", background: "#1a1a28", borderRadius: "2px", overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${barPct}%`, background: barColor, borderRadius: "2px", transition: "width 0.4s" }} />
                      </div>
                      <span style={{ color: "#e8eaf0", fontSize: "11px", fontVariantNumeric: "tabular-nums", textAlign: "right" }}>{e.avg.toFixed(0)}ms</span>
                      <span style={{ color: "#363650", fontSize: "10px", fontVariantNumeric: "tabular-nums", textAlign: "right" }}>{e.count.toLocaleString()}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ color: "#363650", fontSize: "12px" }}>No data yet.</div>
            )}
          </div>
        </div>

        {/* Cache cluster mini */}
        <div style={{ background: "#0d0d14", border: "1px solid #1a1a28", borderRadius: "10px", padding: "18px 20px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px" }}>
            <span style={{ fontSize: "13px", fontWeight: 600 }}>Cache Cluster</span>
            <Link href="/cluster" style={{ fontSize: "12px", color: "#4c8ef7" }}>Full view ↗</Link>
          </div>
          {cluster ? (
            <>
              <div style={{ display: "flex", gap: "16px", fontSize: "13px", color: "#6b7280", marginBottom: "14px", flexWrap: "wrap" }}>
                <span style={{ color: (cluster.summary?.alive ?? 0) === (cluster.summary?.total ?? 0) ? "#22c55e" : "#f59e0b" }}>
                  {cluster.summary?.alive ?? "?"}/{cluster.summary?.total ?? "?"} nodes alive
                </span>
                <span>{cluster.summary?.total_keys ?? 0} keys cached</span>
                <span>3-node consistent hash ring</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px" }}>
                {(cluster.nodes || []).map(n => {
                  const id = n.node_id || n.id || "?";
                  const alive = n.status === "alive";
                  const reqs = n.requests_total;
                  const rps = reqs != null && n.uptime_seconds ? ((reqs / n.uptime_seconds) * 60).toFixed(1) : null;
                  return (
                    <div key={id} style={{ background: "#08080e", border: "1px solid #1a1a28", borderRadius: "8px", padding: "12px 14px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "8px" }}>
                        <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: alive ? "#22c55e" : "#ef4444", boxShadow: alive ? "0 0 5px #22c55e" : "none" }} />
                        <span style={{ fontSize: "12px", fontWeight: 600, fontFamily: "var(--font-geist-mono),monospace" }}>{id}{n.port ? `:${n.port}` : ""}</span>
                      </div>
                      <div style={{ fontSize: "24px", fontWeight: 800, lineHeight: 1 }}>{n.keys_held ?? "—"}</div>
                      <div style={{ fontSize: "10px", color: "#6b7280", marginBottom: "8px" }}>keys cached</div>
                      <div style={{ fontSize: "11px", color: "#363650", display: "flex", flexWrap: "wrap", gap: "4px" }}>
                        {n.uptime_seconds != null && <span>up {fmtUp(n.uptime_seconds)}</span>}
                        {reqs != null && <span>· {reqs.toLocaleString()} reqs</span>}
                        {rps && <span>· {rps}/min</span>}
                      </div>
                      {n.peer_states && (
                        <div style={{ marginTop: "8px", display: "flex", flexDirection: "column", gap: "3px" }}>
                          {Object.entries(n.peer_states).map(([pid, pst]) => (
                            <div key={pid} style={{ display: "flex", justifyContent: "space-between", fontSize: "10px" }}>
                              <span style={{ color: "#6b7280" }}>{pid}</span>
                              <span style={{ color: pst === "alive" ? "#22c55e" : "#ef4444", textTransform: "uppercase", letterSpacing: "0.04em" }}>{pst}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <div style={{ color: "#363650", fontSize: "12px" }}>Loading…</div>
          )}
        </div>

        {/* Live Requests */}
        <div style={{ background: "#0d0d14", border: "1px solid #1a1a28", borderRadius: "10px", overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", borderBottom: "1px solid #1a1a28" }}>
            <span style={{ fontSize: "13px", fontWeight: 600 }}>Live Requests</span>
            <span style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "11px", color: "#22c55e", background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: "20px", padding: "2px 10px" }}>
              <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 5px #22c55e" }} /> streaming
            </span>
          </div>
          <div style={{ overflowX: "auto" }}>
            <div style={{ display: "grid", gridTemplateColumns: "70px 1fr 60px 70px 80px", padding: "8px 20px", fontSize: "10px", color: "#363650", letterSpacing: "0.08em", textTransform: "uppercase", borderBottom: "1px solid #0f0f1a" }}>
              <span>Method</span><span>Path</span><span>Status</span><span>Time</span><span>When</span>
            </div>
            {logs.length === 0 ? (
              <div style={{ padding: "20px", fontSize: "12px", color: "#363650", fontStyle: "italic" }}>Waiting for requests…</div>
            ) : logs.map((r, i) => {
              const s = r.status ?? 0;
              const sCol = s < 400 ? "#22c55e" : s < 500 ? "#f59e0b" : "#ef4444";
              const mCol = r.method === "POST" ? "#a855f7" : "#4c8ef7";
              return (
                <div key={i} className="log-row" style={{ display: "grid", gridTemplateColumns: "70px 1fr 60px 70px 80px", padding: "9px 20px", borderBottom: "1px solid #0a0a14", fontSize: "12px" }}>
                  <span style={{ color: mCol, fontFamily: "var(--font-geist-mono),monospace", fontWeight: 600 }}>{r.method ?? "GET"}</span>
                  <code style={{ color: "#9aa3b8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontFamily: "var(--font-geist-mono),monospace" }}>{r.path ?? "—"}</code>
                  <span style={{ color: sCol, fontFamily: "var(--font-geist-mono),monospace" }}>{s}</span>
                  <span style={{ color: "#6b7280" }}>{r.duration_ms != null ? `${r.duration_ms.toFixed(0)}ms` : "—"}</span>
                  <span style={{ color: "#363650" }}>{r.timestamp ? timeAgo(r.timestamp) : "—"}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* API Explorer */}
        <div style={{ background: "#0d0d14", border: "1px solid #1a1a28", borderRadius: "10px", overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", borderBottom: "1px solid #1a1a28" }}>
            <span style={{ fontSize: "13px", fontWeight: 600 }}>API Explorer</span>
            <a href="https://api.shubhanmehrotra.com/docs" target="_blank" rel="noreferrer" style={{ fontSize: "12px", color: "#4c8ef7" }}>Swagger ↗</a>
          </div>
          <div style={{ padding: "16px 20px" }}>
            <p style={{ fontSize: "12px", color: "#6b7280", marginBottom: "20px" }}>
              Fire live requests against <code style={{ color: "#4c8ef7", fontFamily: "var(--font-geist-mono),monospace" }}>api.shubhanmehrotra.com</code> — responses come directly from the Pixel 7a.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
              {API_GROUPS.map(group => (
                <div key={group.label}>
                  <div style={{ fontSize: "10px", color: "#363650", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "10px", fontWeight: 600 }}>{group.label}</div>
                  <div style={{ background: "#07070d", border: "1px solid #1a1a28", borderRadius: "8px", overflow: "hidden" }}>
                    {group.items.map((ep, idx) => {
                      const out = apiOuts[ep.p];
                      const isGet = ep.m === "GET";
                      return (
                        <div key={ep.p} style={{ borderBottom: idx < group.items.length - 1 ? "1px solid #1a1a28" : "none" }}>
                          <div style={{
                            display: "grid", gridTemplateColumns: "60px 200px 1fr auto",
                            alignItems: "center", padding: "10px 14px", gap: "12px",
                            cursor: "pointer", background: out?.open ? "rgba(76,142,247,0.04)" : "transparent",
                            transition: "background 0.1s",
                          }} onClick={() => out?.open && toggleOut(ep.p)}>
                            <span style={{
                              fontSize: "10px", fontWeight: 700,
                              fontFamily: "var(--font-geist-mono),monospace",
                              color: isGet ? "#22c55e" : "#a855f7",
                              background: isGet ? "rgba(34,197,94,0.1)" : "rgba(168,85,247,0.1)",
                              border: isGet ? "1px solid rgba(34,197,94,0.25)" : "1px solid rgba(168,85,247,0.25)",
                              borderRadius: "4px", padding: "2px 6px", textAlign: "center",
                            }}>{ep.m}</span>
                            <code style={{ fontSize: "12px", color: "#e8eaf0", fontFamily: "var(--font-geist-mono),monospace" }}>{ep.p}</code>
                            <span style={{ fontSize: "12px", color: "#6b7280" }}>{ep.d}</span>
                            <button
                              onClick={e => { e.stopPropagation(); tryEndpoint(ep.p, ep.m); }}
                              style={{
                                padding: "5px 16px", fontSize: "11px", fontWeight: 600,
                                background: "#4c8ef7", color: "#fff", border: "none",
                                borderRadius: "6px", cursor: "pointer", letterSpacing: "0.02em",
                              }}
                            >{out?.loading ? "…" : "Try"}</button>
                          </div>
                          {out?.open && out.data !== null && (
                            <pre style={{
                              background: "#030306", borderTop: "1px solid #1a1a28",
                              padding: "12px 16px", fontSize: "11px", color: "#9aa3b8",
                              maxHeight: "260px", overflow: "auto",
                              fontFamily: "var(--font-geist-mono),monospace", lineHeight: 1.65,
                              whiteSpace: "pre-wrap", wordBreak: "break-all", margin: 0,
                            }}>{out.data}</pre>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 0", fontSize: "12px", color: "#363650", borderTop: "1px solid #1a1a28", marginTop: "8px" }}>
          <Link href="/" style={{ color: "#6b7280", textDecoration: "none" }}>← Portfolio</Link>
          <span>Phoneix · api.shubhanmehrotra.com</span>
          <Link href="/cluster" style={{ color: "#6b7280", textDecoration: "none" }}>Cache Cluster →</Link>
        </div>

      </div>
    </div>
  );
}
