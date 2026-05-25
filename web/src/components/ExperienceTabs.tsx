"use client";

import { useState } from "react";

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
    award: "🏆 Q3 Growth Mindset Award & Q4 Think Big Award",
    bullets: [
      "Slashed p99 endpoint latency by over 95% from peak timeouts via a parallelised multi-pass execution pipeline.",
      "Architecting an event-driven payment recovery engine using AWS Lambda, SQS FIFO queues, and EventBridge to replace third-party retry systems with dynamic, error-classified smart retries.",
      "Architected and deployed a server-side RBAC framework replacing legacy implicit auth with secure JWT token-exchange to enforce granular, row-level data isolation.",
      "Developing FastAPI backend services for a customer-facing analytics dashboard serving 10K+ daily users across multiple microservices.",
      "Architected an automated Post-Invoice Reconciliation Engine using Python and AWS S3 to perform session-level diffs, ensuring 100% financial accuracy.",
      "Engineered a multi-tenant billing framework for 200+ accounts, automating tiered-pricing recovery and reducing overhead by 30%.",
      "Built event-driven subscription tracking via AWS Lambda, SQS DLQs, and Chargebee webhooks ensuring 100% message reliability for 50+ monthly plan upgrades.",
      "Designed DynamoDB GSIs to reduce API latency and refactored exception handling to raise test coverage from 80% to 88%.",
      "Integrated CRM and Slack APIs to automate ticket routing for 15+ exception types, saving 10+ hours of manual triage weekly.",
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
      "Designed and deployed feature flags and access control systems across 4 backend microservices, reducing manual access updates by 50%.",
      "Engineered an automated dual-profile assignment system with an admin UI, reducing user onboarding time by 50%.",
      "Built a real-time CRM sync pipeline using webhooks and event queues, eliminating data staleness across 3 integrated platforms.",
      "Refactored legacy auth middleware to support scoped API tokens, improving security posture without breaking existing integrations.",
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
    <div style={{
      background: "#0d0d14",
      border: "1px solid #1a1a28",
      borderRadius: "12px",
      padding: "20px 24px",
      display: "flex",
      gap: "16px",
      transition: "border-color 0.2s, transform 0.2s, box-shadow 0.2s",
      cursor: "default",
    }}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLElement;
        el.style.borderColor = "#2a2a40";
        el.style.transform = "translateY(-2px)";
        el.style.boxShadow = "0 8px 32px rgba(0,0,0,0.4)";
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLElement;
        el.style.borderColor = "#1a1a28";
        el.style.transform = "translateY(0)";
        el.style.boxShadow = "none";
      }}
    >
      <OrgCircle initial={item.initial} color={item.color} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px" }}>
          <div>
            <div style={{ fontSize: "12px", color: "#6b7280", marginBottom: "2px" }}>
              {item.period} · {item.location}
            </div>
            <div style={{ fontWeight: 700, fontSize: "16px", marginBottom: "1px" }}>{item.org}</div>
            <div style={{ fontSize: "14px", color: "#9aa3b8", marginBottom: item.award ? "8px" : (isSimple ? 0 : "12px") }}>{item.role}</div>
          </div>
          {item.score && (
            <div style={{ fontSize: "14px", fontWeight: 600, color: "#e8eaf0", whiteSpace: "nowrap", flexShrink: 0 }}>{item.score}</div>
          )}
        </div>
        {item.award && (
          <div style={{
            display: "inline-flex", alignItems: "center", gap: "6px",
            fontSize: "12px", color: "#f0a500",
            background: "rgba(240,165,0,0.1)", border: "1px solid rgba(240,165,0,0.25)",
            borderRadius: "6px", padding: "3px 10px", marginBottom: "12px",
          }}>
            {item.award}
          </div>
        )}
        {item.bullets.length > 0 && (
          <ul style={{ listStyle: "disc", paddingLeft: "18px", display: "flex", flexDirection: "column", gap: "5px" }}>
            {item.bullets.map((b, i) => (
              <li key={i} style={{ fontSize: "14px", color: "#9aa3b8", lineHeight: 1.65 }}>{b}</li>
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

  return (
    <div>
      <div style={{
        display: "flex", background: "#0d0d14", border: "1px solid #1a1a28",
        borderRadius: "12px", padding: "4px",
        width: "fit-content", margin: "0 auto 28px",
      }}>
        {(["work", "education"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: "8px 40px", borderRadius: "9px", border: "none",
            background: tab === t ? "#1a1a28" : "transparent",
            color: tab === t ? "#e8eaf0" : "#6b7280",
            fontSize: "14px", fontWeight: 500, cursor: "pointer",
            transition: "background 0.2s, color 0.2s",
            fontFamily: "inherit",
            textTransform: "capitalize",
          }}>
            {t === "work" ? "Work" : "Education"}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
        {items.map((item, i) => (
          <ExperienceCard key={i} item={item} />
        ))}
      </div>
    </div>
  );
}
