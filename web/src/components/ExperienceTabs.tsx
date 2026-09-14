"use client";

import { useLayoutEffect, useRef, useState } from "react";

type Entry = {
  org: string;
  initial: string;
  color: string;
  role: string;
  period: string;
  location: string;
  award: string | null;
  bullets: string[];
  score?: string;
};

const WORK: Entry[] = [
  {
    org: "Entrupy",
    initial: "E",
    color: "#4c8ef7",
    role: "Software Engineer I",
    period: "Jun 2025 – Ongoing",
    location: "Bengaluru, India",
    award: "🏆 Q3 2025 Growth Mindset Award & Q4 2025 Think Big Award",
    bullets: [
      "Architected and shipped an in-house, event-driven payment-retry engine on AWS Lambda, SQS FIFO, EventBridge, and DynamoDB — replacing a third-party dunning system with a custom policy graph supporting pause/resume, partial funds, and self-healing payment-method blacklisting — and hardened it against concurrent-event races with provider-event-ID dedup keys plus DynamoDB conditional writes and consistent reads, so settlement and retry events can never resurrect a resolved invoice.",
      "Designed an automated customer payment-recovery lifecycle: collection pauses when no usable payment method exists, the customer is guided to update it, and retries resume automatically once they do — or wind down through the normal policy path if they never do.",
      "Cut a customer-facing summary endpoint's cold-cache p99 by over 95% to sub-second, by rewriting per-row correlated subqueries into a parallelized two-pass query pipeline with counts recombined at the application layer — equivalence proven via SQL snapshot tests.",
      "Diagnosed a severe p99 regression on a usage endpoint to a non-sargable timestamp predicate scanning full org history; a DST-safe sargable bound across 14 query sites enabled a combined-index plan — ~5× fewer disk block reads, sub-500ms, provably identical results.",
      "Built server-side RBAC and the FastAPI billing API surface for the customer portal — token-based authentication, an explicit roles × resources policy matrix, and row-level ownership enforcement, with dual authentication for internal users and API clients.",
      "Built an automated post-invoice reconciliation engine performing session-level diffs to detect and correct over- and under-billing after invoice closure, validated against a full-population audit of production prepaid usage records (no sampling), including timezone-boundary correctness.",
      "Automated multi-tenant enterprise billing, including master–child invoicing and automatic correction invoicing for contract-based pricing adjustments.",
      "Integrated CRM and Slack APIs for exception-driven ticket routing and alert enrichment, including log-attribution logic that suppresses false-positive latency alerts without touching the underlying alarms.",
    ],
  },
  {
    org: "Entrupy",
    initial: "E",
    color: "#4c8ef7",
    role: "Python Developer Intern",
    period: "Oct 2024 – May 2025",
    location: "Bengaluru, India",
    award: null,
    bullets: [
      "Migrated 5 product access controls from static, code-defined access lists to a centralized feature-flag and user-authorization model spanning 6+ backend services — turning per-customer code deploys into data-driven configuration changes.",
      "Built a User Profiles system across the stack: database migrations, a profile registry with per-category defaults, API serializers, shared client-library accessors consumed by downstream services, and an admin UI for assignment.",
      "Enforced profile-default consistency across every user-creation path, so users get correct defaults regardless of how they enter the system.",
      "Enabled customer self-service toggling of a previously engineering-gated product capability in the portal — removing engineering from the loop for the common case.",
    ],
  },
  {
    org: "TCS Research",
    initial: "T",
    color: "#f0a500",
    role: "Computing Systems Research Intern",
    period: "Jun 2024 – Jul 2024",
    location: "Thane",
    award: null,
    bullets: [
      "Curated and preprocessed 50GB+ of datasets for RAG-based training on LLaMA and Mistral architectures, improving data throughput by 35%.",
      "Optimised hardware utilisation metrics and model data flows, reducing distributed training time by 27.5% on high-compute clusters.",
    ],
  },
];

const EDUCATION: Entry[] = [
  {
    org: "Indian Institute of Technology Palakkad",
    initial: "IIT",
    color: "#ef4444",
    role: "B.Tech. Electrical Engineering",
    period: "2021 – 2025",
    location: "Palakkad, India",
    award: null,
    score: "CGPA: 7.85",
    bullets: [
      "Technical Head, Petrichor'24 — Led technical planning, boosted technical events by 27%, hosted Gaganyaan project director from ISRO.",
      "Project: Pathway — Inter IIT Tech Meet 13.0 — Secured top 10 position with an Agentic RAG pipeline achieving 43% NDCG@10.",
    ],
  },
  {
    org: "Satyameva Jayate International School",
    initial: "CBSE",
    color: "#34c47c",
    role: "Senior Secondary",
    period: "2021",
    location: "Lucknow",
    award: null,
    score: "90.8%",
    bullets: [],
  },
  {
    org: "Aditya Birla Public School Kovaya",
    initial: "CBSE",
    color: "#34c47c",
    role: "Secondary",
    period: "2019",
    location: "Kovaya",
    award: null,
    score: "93.8%",
    bullets: [],
  },
];

function OrgCircle({ initial, color }: { initial: string; color: string }) {
  const len = initial.length;
  const fs = len <= 1 ? 16 : len <= 2 ? 13 : len <= 3 ? 11 : 9;
  return (
    <div style={{
      width: "40px", height: "40px", borderRadius: "50%", flexShrink: 0,
      background: `color-mix(in srgb, ${color} 18%, #0f1117)`,
      border: `1.5px solid color-mix(in srgb, ${color} 35%, transparent)`,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: `${fs}px`, fontWeight: 700, color,
    }}>
      {initial}
    </div>
  );
}

function ExperienceCard({ item }: { item: Entry }) {
  const isSimple = item.bullets.length === 0;
  return (
    <div style={{ display: "flex", gap: "16px" }}>
      <OrgCircle initial={item.initial} color={item.color} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px" }}>
          <div>
            <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.65)", marginBottom: "2px" }}>
              {item.period} · {item.location}
            </div>
            <div style={{ fontWeight: 700, fontSize: "16px", marginBottom: "1px", color: "#fff" }}>{item.org}</div>
            <div style={{ fontSize: "14px", color: "rgba(255,255,255,0.75)", marginBottom: item.award ? "8px" : (isSimple ? 0 : "12px") }}>{item.role}</div>
          </div>
          {item.score && (
            <div style={{ fontSize: "14px", fontWeight: 600, color: "#fff", whiteSpace: "nowrap", flexShrink: 0 }}>{item.score}</div>
          )}
        </div>
        {item.award && (
          <div style={{
            display: "inline-flex", alignItems: "center", gap: "6px",
            fontSize: "12px", color: "#f0a500",
            background: "#623c14", border: "1px solid #f0a500",
            borderRadius: "6px", padding: "3px 10px", marginBottom: "12px",
          }}>
            {item.award}
          </div>
        )}
        {item.bullets.length > 0 && (
          <ul style={{ listStyle: "disc", paddingLeft: "18px", display: "flex", flexDirection: "column", gap: "5px" }}>
            {item.bullets.map((b, i) => (
              <li key={i} style={{ fontSize: "14px", color: "rgba(255,255,255,0.75)", lineHeight: 1.65 }}>{b}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default function ExperienceTabs() {
  const [tab, setTab] = useState<"work" | "education">("work");
  const items = tab === "work" ? WORK : EDUCATION;

  const trackRef = useRef<HTMLDivElement>(null);
  const btnRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [pill, setPill] = useState<{ left: number; width: number } | null>(null);
  // Toggled on then off around each switch purely to retrigger the
  // liquidPillMorph keyframes (a squash-and-stretch wobble layered on top
  // of the plain left/width slide, so the pill reads as soft/liquid
  // instead of a rigid box sliding over).
  const [morphing, setMorphing] = useState(false);

  useLayoutEffect(() => {
    const btn = btnRefs.current[tab];
    const track = trackRef.current;
    if (!btn || !track) return;
    const trackRect = track.getBoundingClientRect();
    const btnRect = btn.getBoundingClientRect();
    setPill({ left: btnRect.left - trackRect.left, width: btnRect.width });
  }, [tab]);

  const selectTab = (t: "work" | "education") => {
    if (t === tab) return;
    setTab(t);
    setMorphing(true);
    // Belt-and-braces alongside onAnimationEnd: if the animationend event
    // ever gets dropped (a reflow interrupts it, the tab is backgrounded),
    // this still clears the class so the next switch can retrigger it.
    window.setTimeout(() => setMorphing(false), 480);
  };

  return (
    <div>
      <div ref={trackRef} style={{
        position: "relative",
        display: "flex", background: "#623c14", border: "1px solid rgba(255,255,255,0.15)",
        borderRadius: "12px", padding: "4px",
        width: "fit-content", margin: "0 auto 28px",
      }}>
        {pill && (
          <div
            className={morphing ? "tab-liquid-pill morphing" : "tab-liquid-pill"}
            onAnimationEnd={() => setMorphing(false)}
            style={{
              position: "absolute", top: "4px", bottom: "4px",
              left: pill.left, width: pill.width,
              borderRadius: "9px",
              // Distinct shade per tab (not just one highlight color reused)
              // so the active state itself signals which one you're on.
              background: tab === "work" ? "#ff921c" : "#c2410c",
            }}
          />
        )}
        {(["work", "education"] as const).map(t => (
          <button
            key={t}
            ref={(el) => { btnRefs.current[t] = el; }}
            onClick={() => selectTab(t)}
            style={{
              position: "relative", zIndex: 1,
              padding: "8px 40px", borderRadius: "9px", border: "none",
              background: "transparent",
              color: tab === t ? "#fff" : "#6b7280",
              fontSize: "14px", fontWeight: 500, cursor: "pointer",
              transition: "color 0.2s",
              fontFamily: "inherit",
              textTransform: "capitalize",
            }}>
            {t === "work" ? "Work" : "Education"}
          </button>
        ))}
      </div>

      <div key={tab} className="exp-fade-in" style={{ display: "flex", flexDirection: "column", gap: "26px" }}>
        {items.map((item, i) => (
          <ExperienceCard key={i} item={item} />
        ))}
      </div>
    </div>
  );
}
