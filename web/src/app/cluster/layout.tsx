import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Cache Cluster — Shubhan Mehrotra",
  description: "Live view of a self-healing 3-node distributed cache cluster — consistent hashing, gossip protocol, and real-time node health.",
};

export default function ClusterLayout({ children }: { children: React.ReactNode }) {
  return children;
}
