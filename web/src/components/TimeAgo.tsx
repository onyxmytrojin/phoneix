"use client";
import { useState, useEffect } from "react";
import { timeAgo } from "@/lib/utils";

export default function TimeAgo({ date, fallback }: { date: string; fallback?: string }) {
  const [label, setLabel] = useState(fallback ?? "");

  useEffect(() => {
    setLabel(timeAgo(date));
    const id = setInterval(() => setLabel(timeAgo(date)), 60_000);
    return () => clearInterval(id);
  }, [date]);

  return <>{label}</>;
}
