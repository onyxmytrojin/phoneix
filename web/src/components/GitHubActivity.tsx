"use client";

import { useEffect, useState } from "react";
import { fetchGithub, type GithubData } from "@/lib/api";
import TimeAgo from "./TimeAgo";

export default function GitHubActivity() {
  const [gh, setGh] = useState<GithubData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchGithub().then(setGh).finally(() => setLoading(false));
  }, []);

  // Distinct from the "no data" case below: while the fetch is still in
  // flight, a skeleton holds the section's place instead of it just being
  // absent — without this the whole block silently popped into existence
  // (or never did, on a slow connection) with no indication anything was
  // loading.
  if (loading) {
    return (
      <section className="content-panel" style={{ marginTop: "24px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
          <h2 style={{ fontSize: "16px", fontWeight: 700, color: "#fff" }}>GitHub Activity</h2>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: "8px" }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="commit-card-skeleton" />
          ))}
        </div>
      </section>
    );
  }

  if (!gh) return null;
  if (!gh.recent_commits?.length) return null;

  return (
    <section className="content-panel" style={{ marginTop: "24px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
        <h2 style={{ fontSize: "16px", fontWeight: 700, color: "#fff" }}>GitHub Activity</h2>
        <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.65)" }}>
          {gh.public_repos} repos · {gh.followers} followers
        </span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: "8px" }}>
        {gh.recent_commits.slice(0, 6).map((c, i) => (
          <a key={i} href={c.url} target="_blank" rel="noreferrer" className="commit-card">
            <div style={{ fontSize: "10px", color: "#f4a261", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: "4px" }}>{c.repo}</div>
            <div style={{ fontSize: "13px", color: "#fff", lineHeight: 1.5 }}>{c.message}</div>
            <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.5)", marginTop: "6px" }}><TimeAgo date={c.date} fallback={c.time_ago} /></div>
          </a>
        ))}
      </div>
    </section>
  );
}
