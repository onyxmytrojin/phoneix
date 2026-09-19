"""Uptime calculation from process heartbeats (pure functions, stdlib only).

Availability used to be inferred from gaps between request-log lines, which
measures visitor traffic rather than uptime: a quiet afternoon on a low-traffic
site read as hours of "downtime" while the process was up the whole time.
Downtime is now a gap in the heartbeat the API writes every
HEARTBEAT_INTERVAL_S (see heartbeat.py) — the process (or phone) was not
running if the beats stop.
"""
from collections import Counter
from datetime import datetime, time as dtime, timedelta, timezone

# Heartbeats land every 60 s, so a normal restart (deploy) leaves a gap of a
# few seconds; more than 3 minutes without a beat means the process or phone
# was genuinely down.
GAP_S = 3 * 60


def _overlap_s(a0: datetime, a1: datetime, b0: datetime, b1: datetime) -> float:
    return max(0.0, (min(a1, b1) - max(a0, b0)).total_seconds())


def _error_endpoints(entries: list[dict], limit: int = 5) -> list[dict]:
    """5xx responses grouped by path, most frequent first."""
    by_path: dict[str, Counter] = {}
    for e in entries:
        st = e.get("status", 200)
        if st >= 500:
            by_path.setdefault(e.get("path", "?"), Counter())[st] += 1
    rows = [
        {"path": p, "count": sum(c.values()), "status": c.most_common(1)[0][0]}
        for p, c in by_path.items()
    ]
    rows.sort(key=lambda r: (-r["count"], r["path"]))
    return rows[:limit]


def compute_availability(
    beats: list[datetime],
    by_day: dict[str, list[dict]],
    now: datetime,
    days: int = 90,
    gap_s: float = GAP_S,
) -> dict:
    beats = sorted(beats)
    first = beats[0] if beats else None

    # Every stretch with no heartbeat for longer than gap_s. The last beat is
    # paired with `now`, so a heartbeat task that died is visible too.
    down: list[tuple[datetime, datetime]] = []
    if beats:
        for a, b in zip(beats, beats[1:] + [now]):
            if (b - a).total_seconds() > gap_s:
                down.append((a, b))

    out = []
    today = now.date()
    for i in range(days - 1, -1, -1):
        d = today - timedelta(days=i)
        entries = by_day.get(d.isoformat(), [])
        errors_count = sum(1 for e in entries if e.get("status", 200) >= 500)

        day_start = datetime.combine(d, dtime.min, tzinfo=timezone.utc)
        w1 = min(day_start + timedelta(days=1), now)
        w0 = max(day_start, first) if first else None

        # No heartbeat coverage for this day (it predates heartbeats, or the
        # day hasn't started): there is nothing to measure, so say so rather
        # than guess.
        if first is None or w1 <= w0:
            out.append({"date": d.isoformat(), "uptime_percent": 100.0, "status": "no_data",
                        "requests": len(entries), "errors": errors_count,
                        "downtime_s": 0, "outages": [], "error_endpoints": []})
            continue

        covered = (w1 - w0).total_seconds()
        outages = []
        for a, b in down:
            s, e = max(a, w0), min(b, w1)
            if (e - s).total_seconds() >= 1:
                outages.append({
                    "start": s.isoformat(), "end": e.isoformat(),
                    "duration_s": int((e - s).total_seconds()),
                    # the gap runs up to "now": the heartbeat has stopped and not resumed
                    "ongoing": b == now,
                })
        downtime = sum(o["duration_s"] for o in outages)
        hb_pct = round((covered - downtime) / covered * 100, 1)
        err_pct = round((1 - errors_count / len(entries)) * 100, 1) if entries else 100.0
        pct = min(hb_pct, err_pct)
        status = "healthy" if pct >= 99.0 else "degraded" if pct >= 90.0 else "incident"
        out.append({"date": d.isoformat(), "uptime_percent": pct, "status": status,
                    "requests": len(entries), "errors": errors_count,
                    "downtime_s": downtime, "outages": outages,
                    "error_endpoints": _error_endpoints(entries)})

    measured = [x["uptime_percent"] for x in out if x["status"] != "no_data"]
    return {
        "days": out,
        "summary": {
            "last_90_days": round(sum(measured) / len(measured), 2) if measured else None,
            "today": out[-1]["uptime_percent"] if out and out[-1]["status"] != "no_data" else None,
            "tracking_since": first.isoformat() if first else None,
        },
    }
