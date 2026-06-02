export const API = "https://api.shubhanmehrotra.com";

export function fmtUp(s?: number): string {
  if (s == null) return "—";
  if (s < 60)   return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
}
