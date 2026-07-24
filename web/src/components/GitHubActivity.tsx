"use client";

import { useEffect, useState } from "react";
import { fetchGithub, type GithubData } from "@/lib/api";
import TimeAgo from "./TimeAgo";

export default function GitHubActivity() {
  const [gh, setGh] = useState<GithubData | null>(null);

  useEffect(() => {
    fetchGithub().then(setGh);
  }, []);

  if (!gh) return null;
  if (!gh.recent_commits?.length) return null;

  return (
    <section style={{ paddingTop: "56px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
        <h2 style={{ fontSize: "16px", fontWeight: 700, color: "#4c8ef7" }}>GitHub Activity</h2>
        <span style={{ fontSize: "12px", color: "#363650" }}>
          {gh.public_repos} repos · {gh.followers} followers
        </span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: "8px" }}>
        {gh.recent_commits.slice(0, 6).map((c, i) => (
          <a key={i} href={c.url} target="_blank" rel="noreferrer" className="commit-card">
            <div style={{ fontSize: "10px", color: "#4c8ef7", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: "4px" }}>{c.repo}</div>
            <div style={{ fontSize: "13px", color: "#e8eaf0", lineHeight: 1.5 }}>{c.message}</div>
            <div style={{ fontSize: "11px", color: "#363650", marginTop: "6px" }}><TimeAgo date={c.date} fallback={c.time_ago} /></div>
          </a>
        ))}
      </div>
    </section>
  );
}
