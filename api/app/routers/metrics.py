import json
import os
import statistics
from collections import defaultdict
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Response
from app.middleware.logging import LOG_PATH

router = APIRouter()

LOG_PATH_ABS = os.path.join(os.path.dirname(__file__), "../../logs/requests.jsonl")


def _read_logs(hours: int = 24) -> list[dict]:
    cutoff = datetime.now(timezone.utc) - timedelta(hours=hours)
    entries = []
    try:
        with open(LOG_PATH_ABS) as f:
            for line in f:
                try:
                    e = json.loads(line.strip())
                    ts = datetime.fromisoformat(e["timestamp"])
                    if ts >= cutoff:
                        entries.append(e)
                except Exception:
                    continue
    except FileNotFoundError:
        pass
    return entries


@router.get("/response-times")
async def response_times(response: Response):
    response.headers["Cache-Control"] = "no-store"
    logs = _read_logs(24)

    by_path: dict[str, list[float]] = defaultdict(list)
    for e in logs:
        by_path[e.get("path", "unknown")].append(e.get("duration_ms", 0))

    result = {}
    for path, times in by_path.items():
        if not times:
            continue
        times_sorted = sorted(times)
        n = len(times_sorted)
        result[path] = {
            "p50": round(times_sorted[int(n * 0.50)], 1),
            "p95": round(times_sorted[int(n * 0.95)], 1),
            "p99": round(times_sorted[min(int(n * 0.99), n - 1)], 1),
            "count": n,
        }

    return {"window": "24h", "endpoints": result}


@router.get("/metrics")
async def metrics(response: Response):
    response.headers["Cache-Control"] = "no-store"
    response.headers["Content-Type"] = "text/plain"
    logs = _read_logs(24)

    counts: dict[tuple, int] = defaultdict(int)
    durations: dict[str, list[float]] = defaultdict(list)

    for e in logs:
        key = (e.get("method", "GET"), e.get("path", "/"), str(e.get("status", 200)))
        counts[key] += 1
        durations[e.get("path", "/")].append(e.get("duration_ms", 0))

    lines = ["# HELP http_requests_total Total HTTP requests",
             "# TYPE http_requests_total counter"]
    for (method, path, status), count in counts.items():
        lines.append(f'http_requests_total{{method="{method}",endpoint="{path}",status="{status}"}} {count}')

    lines += ["# HELP http_request_duration_ms Request duration ms",
              "# TYPE http_request_duration_ms summary"]
    for path, times in durations.items():
        if times:
            s = sorted(times)
            n = len(s)
            lines.append(f'http_request_duration_ms{{endpoint="{path}",quantile="0.5"}} {s[int(n*0.5)]}')
            lines.append(f'http_request_duration_ms{{endpoint="{path}",quantile="0.95"}} {s[int(n*0.95)]}')
            lines.append(f'http_request_duration_ms{{endpoint="{path}",quantile="0.99"}} {s[min(int(n*0.99),n-1)]}')

    return "\n".join(lines)


@router.get("/availability")
async def availability(response: Response):
    response.headers["Cache-Control"] = "max-age=300"
    logs = _read_logs(24 * 90)

    # bucket logs by day
    by_day: dict[str, list] = defaultdict(list)
    for e in logs:
        try:
            day = e["timestamp"][:10]
            by_day[day].append(e["status"])
        except Exception:
            continue

    today = datetime.now(timezone.utc).date()
    days = []
    for i in range(29, -1, -1):
        day = (today - timedelta(days=i)).isoformat()
        statuses = by_day.get(day, [])
        if not statuses:
            pct = 100.0
            status = "no_data"
        else:
            errors = sum(1 for s in statuses if s >= 500)
            pct = round((1 - errors / len(statuses)) * 100, 1)
            status = "healthy" if pct == 100 else "degraded" if pct >= 95 else "incident"
        days.append({"date": day, "uptime_percent": pct, "status": status, "requests": len(statuses)})

    all_pcts = [d["uptime_percent"] for d in days if d["status"] != "no_data"]
    avg = round(sum(all_pcts) / len(all_pcts), 2) if all_pcts else 100.0

    return {
        "days": days,
        "summary": {
            "last_30_days": avg,
            "today": days[-1]["uptime_percent"] if days else 100.0,
        }
    }


@router.get("/visitors")
async def visitors(response: Response):
    response.headers["Cache-Control"] = "no-store"
    today_str = datetime.now(timezone.utc).date().isoformat()
    week_ago = (datetime.now(timezone.utc) - timedelta(days=7)).date().isoformat()

    logs_90 = _read_logs(24 * 90)
    unique_today = set()
    unique_week = set()

    for e in logs_90:
        day = e.get("timestamp", "")[:10]
        ip = e.get("ip_hash", "")
        if not ip:
            continue
        if day == today_str:
            unique_today.add(ip)
        if day >= week_ago:
            unique_week.add(ip)

    return {
        "today": len(unique_today),
        "this_week": len(unique_week),
        "all_time": len(set(e.get("ip_hash", "") for e in logs_90 if e.get("ip_hash"))),
    }


@router.get("/logs")
async def logs(response: Response):
    response.headers["Cache-Control"] = "no-store"
    entries = _read_logs(1)
    return {"logs": entries[-50:]}
