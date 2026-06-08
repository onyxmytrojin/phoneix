import { API } from "./utils";

export interface GithubData {
  username: string;
  public_repos: number;
  followers: number;
  avatar_url: string;
  profile_url: string;
  recent_commits: Array<{
    repo: string;
    message: string;
    date: string;
    time_ago: string;
    url: string;
  }>;
}

export interface ServerData {
  uptime_human: string;
  cpu_percent: number;
  memory: { used_gb: number; total_gb: number; percent_used: number };
  disk: { free_gb: number; total_gb: number };
  load_avg: [number, number, number];
}

export async function fetchGithub(): Promise<GithubData | null> {
  try {
    const res = await fetch(`${API}/v1/github`);
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function fetchServer(): Promise<ServerData | null> {
  try {
    const res = await fetch(`${API}/v1/server`);
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}
