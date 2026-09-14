"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { API, fmtUp, timeAgo } from "@/lib/utils";

const DASH_PATHS = new Set(["/v1/server","/v1/logs","/v1/cluster","/v1/cluster/keys",
  "/v1/ping","/v1/response-times","/v1/availability","/v1/visitors"]);

type LogEntry = { method?: string; path?: string; status?: number; duration_ms?: number; timestamp?: string };
type NodeData  = { node_id?: string; id?: string; status?: string; port?: number; keys_held?: number; uptime_seconds?: number; requests_total?: number; peer_states?: Record<string,string> };
type SrvData   = { uptime_human?: string; cpu_percent?: number; memory?: { used_gb: number; total_gb: number; percent_used: number }; disk?: { free_gb: number; total_gb: number }; load_avg?: number[] };
type AvailDay  = { date: string; status: string; uptime_percent: number; requests?: number; errors?: number };
type AvailData = { days?: AvailDay[]; summary?: { last_30_days?: number; last_90_days?: number } };
type RespData     = { endpoints?: Record<string, { p50?: number; count?: number }> };
type ClusterData  = { nodes?: NodeData[]; summary?: { alive?: number; total?: number; total_keys?: number } };
type VisitorData  = { today?: number; this_week?: number; all_time?: number };

// ── Server room palette — deliberately NOT the portfolio's warm yellow.
// A dark navy base with three semantic status colors (green/orange/red for
// active, degraded, failure) plus one deep-red accent for anything
// interactive (links, buttons, the day-range toggle). Same font as the
// portfolio (inherited from body — see globals.css), same card-hover-lift
// animation language (.srv-card, defined there too).
const BG          = "#050505";
const CARD        = "#141414";
const CARD_INNER  = "#0a0a0a";
const BORDER      = "#262626";
const BORDER_SOFT = "rgba(255,255,255,0.06)";
const TEXT        = "#e8eaf0";
const MUTED       = "#8a8a8a";
const FAINT       = "#525252";
const ACCENT      = "#A30000";
const GREEN       = "#84B082";
const ORANGE      = "#E28413";
const RED         = "#95190C";

const STATUS_COLOR = {
  incident: RED,
  degraded: ORANGE,
  no_data:  "#1a1a1a",
  healthy:  GREEN,
} as const;

// Dark-to-bright green tiers for the uptime heatmap (a themed replacement
// for the old GitHub-contribution-graph greens, built from GREEN blended
// against the near-black background).
const GREEN_TIERS = ["#2b382b", "#4b634a", "#6b8e69", "#7ba078", GREEN];

function uptimeColor(d: AvailDay) {
  if (d.status === "no_data")  return STATUS_COLOR.no_data;
  if (d.status === "incident") return STATUS_COLOR.incident;
  if (d.status === "degraded") return STATUS_COLOR.degraded;
  const p = d.uptime_percent;
  return p === 100 ? GREEN_TIERS[4] : p >= 95 ? GREEN_TIERS[3] : p >= 80 ? GREEN_TIERS[2] : GREEN_TIERS[1];
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

export default function ServerPage() {
  const [srv,       setSrv]      = useState<SrvData | null>(null);
  const [avail,     setAvail]    = useState<AvailData | null>(null);
  const [resp,      setResp]     = useState<RespData | null>(null);
  const [cluster,   setCluster]  = useState<ClusterData | null>(null);
  const [logs,      setLogs]     = useState<LogEntry[]>([]);
  const [visitors,  setVisitors] = useState<VisitorData | null>(null);
  const [uptimeDays, setUptimeDays] = useState(90);
  const [selDay,    setSelDay]   = useState<AvailDay | null>(null);
  // Gates the whole dashboard on the FIRST successful fetch only (not
  // every 5s poll after) — without this, every metric's `?? 0` fallback
  // rendered as a real (if misleading) "0%" / "0 GB" the instant the page
  // mounted, before the phone had actually answered even once.
  const [initialLoading, setInitialLoading] = useState(true);

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
      setInitialLoading(false);
    }
    async function slow() {
      const [a, r, c, v] = await Promise.all([
        fetch(`${API}/v1/availability`,   { signal }).then(x => x.json()).catch(() => null),
        fetch(`${API}/v1/response-times`, { signal }).then(x => x.json()).catch(() => null),
        fetch(`${API}/v1/cluster`,        { signal }).then(x => x.json()).catch(() => null),
        fetch(`${API}/v1/visitors`,       { signal }).then(x => x.json()).catch(() => null),
      ]);
      if (a) setAvail(a);
      if (r) setResp(r);
      if (c) setCluster(c);
      if (v) setVisitors(v);
    }
    fast(); slow();
    const fi = setInterval(fast, 5000);
    const si = setInterval(slow, 15000);
    return () => { ac.abort(); clearInterval(fi); clearInterval(si); };
  }, []);

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

  // 3-tier status color, consistent everywhere a metric needs one: green
  // when healthy, orange once it's elevated, red once it's critical.
  const tier = (v: number, warn: number, crit: number) => v > crit ? RED : v > warn ? ORANGE : GREEN;

  const BAR = (pct: number, color: string) => (
    <div style={{ height: "4px", background: CARD_INNER, borderRadius: "2px", overflow: "hidden", margin: "8px 0 6px" }}>
      <div style={{ height: "100%", width: `${Math.min(100, pct)}%`, background: color, borderRadius: "2px", transition: "width 0.5s" }} />
    </div>
  );

  if (initialLoading) {
    return (
      <div style={{
        minHeight: "100vh", background: BG, color: MUTED,
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        gap: "12px", fontSize: "13px",
      }}>
        <div style={{
          width: "28px", height: "28px", borderRadius: "50%",
          border: `2px solid ${BORDER}`, borderTopColor: ACCENT,
          animation: "spin 0.8s linear infinite",
        }} />
        Connecting to the phone…
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: BG, color: TEXT }}>

      {/* ── Nav ── */}
      <nav style={{
        position: "sticky", top: 0, zIndex: 50,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 24px", height: "48px",
        background: "rgba(5,5,5,0.92)", backdropFilter: "blur(10px)",
        borderBottom: `1px solid ${BORDER}`, fontSize: "13px",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", color: MUTED }}>
          <Link href="/" style={{ color: ACCENT, textDecoration: "none" }}>← Shubhan Mehrotra</Link>
          <span>/</span>
          <span style={{ color: TEXT }}>Server</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          <Link href="/cluster" style={{ color: MUTED, fontSize: "12px", textDecoration: "none" }}>Cache Cluster →</Link>
          <a href="https://api.shubhanmehrotra.com/docs" target="_blank" rel="noreferrer" style={{ color: ACCENT, fontSize: "12px" }}>API Docs ↗</a>
        </div>
      </nav>

      {/* ── Hero ── */}
      <div style={{
        background: BG,
        backgroundImage: "linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)",
        backgroundSize: "32px 32px",
        borderBottom: `1px solid ${BORDER}`,
      }}>
        <div style={{ maxWidth: "960px", margin: "0 auto", padding: "40px 24px 36px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "32px", flexWrap: "wrap" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
              <span style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "12px", color: GREEN, background: "rgba(132,176,130,0.1)", border: "1px solid rgba(132,176,130,0.3)", borderRadius: "20px", padding: "3px 10px", fontWeight: 600 }}>
                <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: GREEN, boxShadow: `0 0 6px ${GREEN}` }} /> Live
              </span>
              <span style={{ fontSize: "13px", color: MUTED }}>Bangalore, India</span>
            </div>
            <h1 style={{ fontSize: "clamp(26px,5vw,40px)", fontWeight: 800, lineHeight: 1.1, marginBottom: "10px", letterSpacing: "-0.02em" }}>
              Phoneix <span style={{ color: ACCENT }}>Server</span>
            </h1>
            <p style={{ fontSize: "13px", color: ACCENT, marginBottom: "10px", fontFamily: "var(--font-geist-mono), monospace" }}>
              Google Pixel 7a · ARM64 · Debian (proot) · GrapheneOS
            </p>
            <p style={{ fontSize: "14px", color: MUTED, maxWidth: "420px", lineHeight: 1.65 }}>
              This page is served from a phone in my room. Every number below is pulled live from the hardware running it.
            </p>
          </div>
          <div className="srv-card" style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: "10px", padding: "20px 28px", textAlign: "center", flexShrink: 0 }}>
            <div style={{ fontSize: "10px", color: MUTED, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "8px" }}>Uptime</div>
            <div style={{ fontSize: "32px", fontWeight: 800, lineHeight: 1 }}>{srv?.uptime_human ?? "—"}</div>
            <div style={{ fontSize: "11px", color: FAINT, marginTop: "8px" }}>since last restart</div>
          </div>
        </div>
      </div>

      {/* ── Main ── */}
      <div style={{ maxWidth: "960px", margin: "0 auto", padding: "24px", display: "flex", flexDirection: "column", gap: "16px" }}>

        {/* Stats row */}
        <div className="stats-grid">
          {/* CPU */}
          <div className="srv-card" style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: "10px", padding: "16px 18px" }}>
            <div style={{ fontSize: "11px", color: MUTED, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: "6px" }}>CPU</div>
            <div style={{ fontSize: "28px", fontWeight: 800, lineHeight: 1.1 }}>{cpu.toFixed(1)}%</div>
            {BAR(cpu, tier(cpu, 65, 85))}
            <div style={{ fontSize: "11px", color: FAINT }}>sched_pixel · load/freq blend</div>
          </div>
          {/* Memory */}
          <div className="srv-card" style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: "10px", padding: "16px 18px" }}>
            <div style={{ fontSize: "11px", color: MUTED, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: "6px" }}>Memory</div>
            <div style={{ fontSize: "28px", fontWeight: 800, lineHeight: 1.1 }}>{memUsed.toFixed(1)} GB</div>
            {BAR(memPct, tier(memPct, 65, 85))}
            <div style={{ fontSize: "11px", color: FAINT }}>of {memTotal.toFixed(1)} GB</div>
          </div>
          {/* Disk */}
          <div className="srv-card" style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: "10px", padding: "16px 18px" }}>
            <div style={{ fontSize: "11px", color: MUTED, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: "6px" }}>Disk Free</div>
            <div style={{ fontSize: "28px", fontWeight: 800, lineHeight: 1.1 }}>{diskFree.toFixed(0)} GB</div>
            {BAR(diskPct, tier(diskPct, 65, 85))}
            <div style={{ fontSize: "11px", color: FAINT }}>of {diskTot.toFixed(0)} GB total</div>
          </div>
          {/* Load */}
          <div className="srv-card" style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: "10px", padding: "16px 18px" }}>
            <div style={{ fontSize: "11px", color: MUTED, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: "6px" }}>Load Avg</div>
            <div style={{ fontSize: "28px", fontWeight: 800, lineHeight: 1.1 }}>{(load[0] ?? 0).toFixed(2)}</div>
            <div style={{ display: "flex", gap: "6px", marginTop: "16px" }}>
              {load.slice(0, 3).map((v, i) => (
                <span key={i} style={{ fontSize: "11px", color: MUTED, background: CARD_INNER, borderRadius: "4px", padding: "2px 6px", fontFamily: "var(--font-geist-mono), monospace", fontVariantNumeric: "tabular-nums" }}>{(v ?? 0).toFixed(2)}</span>
              ))}
            </div>
          </div>
          {/* Visitors */}
          <div className="srv-card" style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: "10px", padding: "16px 18px" }}>
            <div style={{ fontSize: "11px", color: MUTED, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: "6px" }}>Visitors</div>
            <div style={{ fontSize: "28px", fontWeight: 800, lineHeight: 1.1 }}>{visitors?.today ?? "—"}</div>
            <div style={{ display: "flex", gap: "6px", marginTop: "8px", flexWrap: "wrap" }}>
              {visitors && <>
                <span style={{ fontSize: "10px", color: MUTED, background: CARD_INNER, borderRadius: "4px", padding: "2px 6px", fontVariantNumeric: "tabular-nums" }}>{visitors.this_week} wk</span>
                <span style={{ fontSize: "10px", color: MUTED, background: CARD_INNER, borderRadius: "4px", padding: "2px 6px", fontVariantNumeric: "tabular-nums" }}>{visitors.all_time} total</span>
              </>}
            </div>
            <div style={{ fontSize: "11px", color: FAINT, marginTop: "4px" }}>unique IPs today</div>
          </div>
        </div>

        {/* Two-column: uptime | response times */}
        <div className="split-grid">
          {/* 30-day uptime */}
          <div className="srv-card" style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: "10px", padding: "18px 20px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
              <span style={{ fontSize: "13px", fontWeight: 600 }}>{uptimeDays}-Day Uptime</span>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <div style={{ display: "flex", gap: "3px" }}>
                  {[30, 60, 90].map(d => (
                    <button key={d} onClick={() => { setUptimeDays(d); setSelDay(null); }} style={{
                      padding: "2px 8px", fontSize: "10px", borderRadius: "4px", border: "none",
                      cursor: "pointer", fontFamily: "inherit", letterSpacing: "0.04em",
                      background: uptimeDays === d ? ACCENT : CARD_INNER,
                      color: uptimeDays === d ? "#fff" : MUTED,
                      transition: "background 0.15s",
                    }}>{d}d</button>
                  ))}
                </div>
                {(avail?.summary?.last_90_days ?? avail?.summary?.last_30_days) != null && (
                  <span style={{ fontSize: "11px", color: GREEN, background: "rgba(132,176,130,0.1)", border: "1px solid rgba(132,176,130,0.25)", borderRadius: "4px", padding: "2px 8px" }}>
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
              const statusColor = (d: AvailDay) => d.status === "no_data" ? MUTED : STATUS_COLOR[d.status as keyof typeof STATUS_COLOR] ?? GREEN;
              return (
                <div style={{ overflowX: "auto" }}>
                  {/* Month labels */}
                  <div style={{ display: "flex", marginLeft: "20px", marginBottom: "4px", position: "relative", height: "13px" }}>
                    {months.map(m => (
                      <div key={m.col} style={{ position: "absolute", left: `${m.col * (SZ + GAP)}px`, fontSize: "9px", color: MUTED, whiteSpace: "nowrap", letterSpacing: "0.04em" }}>{m.label}</div>
                    ))}
                  </div>
                  <div style={{ display: "flex", gap: `${GAP}px` }}>
                    {/* Day-of-week labels */}
                    <div style={{ display: "flex", flexDirection: "column", gap: `${GAP}px`, paddingTop: "1px" }}>
                      {["","M","","W","","F",""].map((l, i) => (
                        <div key={i} style={{ width: "13px", height: `${SZ}px`, fontSize: "9px", color: MUTED, lineHeight: `${SZ}px`, textAlign: "right" }}>{l}</div>
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
                              outline: day && selDay?.date === day.date ? `2px solid ${TEXT}` : "none",
                              outlineOffset: "1px",
                            }} />
                        ))}
                      </div>
                    ))}
                  </div>

                  {/* Selected day popover */}
                  {selDay && (
                    <div style={{ marginTop: "10px", padding: "10px 14px", background: CARD_INNER, border: `1px solid ${statusColor(selDay)}40`, borderLeft: `3px solid ${statusColor(selDay)}`, borderRadius: "6px", fontSize: "12px", display: "flex", flexWrap: "wrap", gap: "14px", alignItems: "center" }}>
                      <div>
                        <div style={{ fontWeight: 600, marginBottom: "2px" }}>{new Date(selDay.date + "T12:00:00Z").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}</div>
                        <div style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "11px" }}>
                          <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: statusColor(selDay), flexShrink: 0 }} />
                          <span style={{ color: statusColor(selDay), fontWeight: 600, textTransform: "capitalize" }}>{statusLabel(selDay)}</span>
                        </div>
                      </div>
                      {selDay.status !== "no_data" && <>
                        <div style={{ textAlign: "center" }}>
                          <div style={{ fontSize: "18px", fontWeight: 700, color: TEXT, lineHeight: 1 }}>{selDay.uptime_percent}%</div>
                          <div style={{ fontSize: "10px", color: MUTED, letterSpacing: "0.06em", textTransform: "uppercase" }}>uptime</div>
                        </div>
                        <div style={{ textAlign: "center" }}>
                          <div style={{ fontSize: "18px", fontWeight: 700, color: TEXT, lineHeight: 1 }}>{(selDay.requests ?? 0).toLocaleString()}</div>
                          <div style={{ fontSize: "10px", color: MUTED, letterSpacing: "0.06em", textTransform: "uppercase" }}>requests</div>
                        </div>
                        <div style={{ textAlign: "center" }}>
                          <div style={{ fontSize: "18px", fontWeight: 700, color: (selDay.errors ?? 0) > 0 ? RED : TEXT, lineHeight: 1 }}>{(selDay.errors ?? 0).toLocaleString()}</div>
                          <div style={{ fontSize: "10px", color: MUTED, letterSpacing: "0.06em", textTransform: "uppercase" }}>errors</div>
                        </div>
                        {(selDay.requests ?? 0) > 0 && (
                          <div style={{ fontSize: "11px", color: MUTED }}>
                            {selDay.status !== "healthy" && (selDay.errors ?? 0) === 0
                              ? `Server unreachable for ~${(100 - selDay.uptime_percent).toFixed(1)}% of the day`
                              : (selDay.errors ?? 0) === 0
                              ? "All requests succeeded"
                              : `${selDay.errors} requests failed (5xx)`}
                          </div>
                        )}
                      </>}
                      {selDay.status === "no_data" && (
                        <div style={{ fontSize: "11px", color: MUTED }}>Server was not running or no requests recorded on this day.</div>
                      )}
                    </div>
                  )}

                  {/* Legend */}
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "10px", fontSize: "10px", color: MUTED }}>
                    <span>Less</span>
                    {[STATUS_COLOR.no_data, ...GREEN_TIERS.slice(0, 4)].map((c, i) => (
                      <div key={i} style={{ width: `${SZ}px`, height: `${SZ}px`, borderRadius: "2px", background: c, flexShrink: 0 }} />
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
          <div className="srv-card" style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: "10px", padding: "18px 20px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
              <span style={{ fontSize: "13px", fontWeight: 600 }}>Response Times</span>
              <span style={{ fontSize: "11px", color: FAINT }}>avg ms per endpoint</span>
            </div>
            {respRows.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "7px" }}>
                {respRows.map(e => {
                  const barPct = Math.max(1, Math.min(100, (e.avg / maxAvg) * 100));
                  const barColor = tier(e.avg, 150, 500);
                  return (
                    <div key={e.path} style={{ display: "grid", gridTemplateColumns: "130px 1fr 52px 42px", gap: "8px", alignItems: "center" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "5px", minWidth: 0 }}>
                        <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: barColor, flexShrink: 0 }} />
                        <code style={{ fontSize: "10px", color: MUTED, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.path}</code>
                      </div>
                      <div style={{ height: "4px", background: CARD_INNER, borderRadius: "2px", overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${barPct}%`, background: barColor, borderRadius: "2px", transition: "width 0.4s" }} />
                      </div>
                      <span style={{ color: TEXT, fontSize: "11px", fontVariantNumeric: "tabular-nums", textAlign: "right" }}>{e.avg.toFixed(0)}ms</span>
                      <span style={{ color: FAINT, fontSize: "10px", fontVariantNumeric: "tabular-nums", textAlign: "right" }}>{e.count.toLocaleString()}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ color: FAINT, fontSize: "12px" }}>No data yet.</div>
            )}
          </div>
        </div>

        {/* Cache cluster mini */}
        <div className="srv-card" style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: "10px", padding: "18px 20px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px" }}>
            <span style={{ fontSize: "13px", fontWeight: 600 }}>Cache Cluster</span>
            <Link href="/cluster" style={{ fontSize: "12px", color: ACCENT }}>Full view ↗</Link>
          </div>
          {cluster ? (
            <>
              <div style={{ display: "flex", gap: "16px", fontSize: "13px", color: MUTED, marginBottom: "14px", flexWrap: "wrap" }}>
                <span style={{ color: (cluster.summary?.alive ?? 0) === (cluster.summary?.total ?? 0) ? GREEN : ORANGE }}>
                  {cluster.summary?.alive ?? "?"}/{cluster.summary?.total ?? "?"} nodes alive
                </span>
                <span>{cluster.summary?.total_keys ?? 0} keys cached</span>
                <span>3-node consistent hash ring</span>
              </div>
              <div className="cache-nodes-grid">
                {(cluster.nodes || []).map(n => {
                  const id = n.node_id || n.id || "?";
                  const alive = n.status === "alive";
                  const reqs = n.requests_total;
                  const rps = reqs != null && n.uptime_seconds ? ((reqs / n.uptime_seconds) * 60).toFixed(1) : null;
                  return (
                    <div key={id} className="srv-card" style={{ background: CARD_INNER, border: `1px solid ${BORDER}`, borderRadius: "8px", padding: "12px 14px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "8px" }}>
                        <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: alive ? GREEN : RED, boxShadow: alive ? `0 0 5px ${GREEN}` : "none" }} />
                        <span style={{ fontSize: "12px", fontWeight: 600, fontFamily: "var(--font-geist-mono),monospace" }}>{id}{n.port ? `:${n.port}` : ""}</span>
                      </div>
                      <div style={{ fontSize: "24px", fontWeight: 800, lineHeight: 1 }}>{n.keys_held ?? "—"}</div>
                      <div style={{ fontSize: "10px", color: MUTED, marginBottom: "8px" }}>keys cached</div>
                      <div style={{ fontSize: "11px", color: FAINT, display: "flex", flexWrap: "wrap", gap: "4px" }}>
                        {n.uptime_seconds != null && <span>up {fmtUp(n.uptime_seconds)}</span>}
                        {reqs != null && <span>· {reqs.toLocaleString()} reqs</span>}
                        {rps && <span>· {rps}/min</span>}
                      </div>
                      {n.peer_states && (
                        <div style={{ marginTop: "8px", display: "flex", flexDirection: "column", gap: "3px" }}>
                          {Object.entries(n.peer_states).map(([pid, pst]) => (
                            <div key={pid} style={{ display: "flex", justifyContent: "space-between", fontSize: "10px" }}>
                              <span style={{ color: MUTED }}>{pid}</span>
                              <span style={{ color: pst === "alive" ? GREEN : RED, textTransform: "uppercase", letterSpacing: "0.04em" }}>{pst}</span>
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
            <div style={{ color: FAINT, fontSize: "12px" }}>Loading…</div>
          )}
        </div>

        {/* Live Requests */}
        <div className="srv-card" style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: "10px", overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", borderBottom: `1px solid ${BORDER}` }}>
            <span style={{ fontSize: "13px", fontWeight: 600 }}>Live Requests</span>
            <span style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "11px", color: GREEN, background: "rgba(132,176,130,0.1)", border: "1px solid rgba(132,176,130,0.25)", borderRadius: "20px", padding: "2px 10px" }}>
              <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: GREEN, boxShadow: `0 0 5px ${GREEN}` }} /> streaming
            </span>
          </div>
          <div style={{ overflowX: "auto" }}>
            <div style={{ display: "grid", gridTemplateColumns: "70px 1fr 60px 70px 80px", padding: "8px 20px", fontSize: "10px", color: FAINT, letterSpacing: "0.08em", textTransform: "uppercase", borderBottom: `1px solid ${BORDER_SOFT}` }}>
              <span>Method</span><span>Path</span><span>Status</span><span>Time</span><span>When</span>
            </div>
            {logs.length === 0 ? (
              <div style={{ padding: "20px", fontSize: "12px", color: FAINT, fontStyle: "italic" }}>Waiting for requests…</div>
            ) : logs.map((r, i) => {
              const s = r.status ?? 0;
              const sCol = s < 400 ? GREEN : s < 500 ? ORANGE : RED;
              const mCol = r.method === "POST" ? ORANGE : GREEN;
              return (
                <div key={i} className="log-row" style={{ display: "grid", gridTemplateColumns: "70px 1fr 60px 70px 80px", padding: "9px 20px", borderBottom: `1px solid ${BORDER_SOFT}`, fontSize: "12px" }}>
                  <span style={{ color: mCol, fontFamily: "var(--font-geist-mono),monospace", fontWeight: 600 }}>{r.method ?? "GET"}</span>
                  <code style={{ color: MUTED, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontFamily: "var(--font-geist-mono),monospace" }}>{r.path ?? "—"}</code>
                  <span style={{ color: sCol, fontFamily: "var(--font-geist-mono),monospace" }}>{s}</span>
                  <span className="log-col-time" style={{ color: MUTED }}>{r.duration_ms != null ? `${r.duration_ms.toFixed(0)}ms` : "—"}</span>
                  <span className="log-col-when" style={{ color: FAINT }}>{r.timestamp ? timeAgo(r.timestamp) : "—"}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 0", fontSize: "12px", color: FAINT, borderTop: `1px solid ${BORDER}`, marginTop: "8px" }}>
          <Link href="/" style={{ color: MUTED, textDecoration: "none" }}>← Portfolio</Link>
          <span>Phoneix · api.shubhanmehrotra.com</span>
          <Link href="/cluster" style={{ color: MUTED, textDecoration: "none" }}>Cache Cluster →</Link>
        </div>

      </div>
    </div>
  );
}
