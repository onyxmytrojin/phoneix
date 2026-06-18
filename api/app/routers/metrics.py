import asyncio
import asyncio.subprocess as asp
import json
import os
import statistics
import time
from collections import defaultdict
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Response, HTTPException, Request
from app.middleware.logging import LOG_PATH

# Cache node addresses — override via CACHE_NODES env var as comma-separated
# host:tcp-port pairs: "localhost:6001,localhost:6002,localhost:6003"
_raw = os.getenv("CACHE_NODES", "localhost:6001,localhost:6002,localhost:6003")
_CACHE_NODES = [tuple(n.split(":")) for n in _raw.split(",") if ":" in n]
_CACHE_NODE_IDS = os.getenv("CACHE_NODE_IDS", "node-a,node-b,node-c").split(",")


async def _cache_cmd(host: str, port: str, command: str, timeout: float = 2.0) -> str:
    try:
        reader, writer = await asyncio.wait_for(
            asyncio.open_connection(host, int(port)), timeout=timeout
        )
        writer.write(f"{command}\r\n".encode())
        await writer.drain()
        line = await asyncio.wait_for(reader.readline(), timeout=timeout)
        writer.close()
        try:
            await writer.wait_closed()
        except Exception:
            pass
        return line.decode().strip()
    except Exception as e:
        return f"ERR {e}"

router = APIRouter()

LOG_PATH_ABS = os.path.join(os.path.dirname(__file__), "../../logs/requests.jsonl")


def _read_logs(hours: int = 24) -> list[dict]:
    """Read log entries within the last `hours` by scanning backward from EOF.
    Stops as soon as it finds a line older than the cutoff, so short windows
    are O(recent data) rather than O(total file size)."""
    cutoff = datetime.now(timezone.utc) - timedelta(hours=hours)
    results: list[dict] = []
    chunk = 1 << 16  # 64 KiB
    try:
        with open(LOG_PATH_ABS, "rb") as f:
            f.seek(0, 2)
            pos = f.tell()
            tail = b""
            while pos > 0:
                step = min(chunk, pos)
                pos -= step
                f.seek(pos)
                block = f.read(step) + tail
                lines = block.split(b"\n")
                tail = lines[0]
                for raw in reversed(lines[1:]):
                    raw = raw.strip()
                    if not raw:
                        continue
                    try:
                        e = json.loads(raw)
                        ts = datetime.fromisoformat(e["timestamp"])
                        if ts < cutoff:
                            results.reverse()
                            return results
                        results.append(e)
                    except Exception:
                        continue
            if tail.strip():
                try:
                    e = json.loads(tail.strip())
                    ts = datetime.fromisoformat(e["timestamp"])
                    if ts >= cutoff:
                        results.append(e)
                except Exception:
                    pass
    except FileNotFoundError:
        pass
    results.reverse()
    return results


_avail_cache: tuple[float, dict] | None = None


def _rotate_logs() -> int:
    """Remove entries older than 90 days. Writes atomically via a temp file.
    Returns the number of entries removed."""
    global _avail_cache
    cutoff = datetime.now(timezone.utc) - timedelta(days=90)
    try:
        if not os.path.exists(LOG_PATH_ABS):
            return 0
        kept: list[str] = []
        removed = 0
        with open(LOG_PATH_ABS) as f:
            for line in f:
                stripped = line.strip()
                if not stripped:
                    continue
                try:
                    ts = datetime.fromisoformat(json.loads(stripped)["timestamp"])
                    if ts < cutoff:
                        removed += 1
                        continue
                except Exception:
                    pass
                kept.append(line if line.endswith("\n") else line + "\n")
        if removed == 0:
            return 0
        tmp = LOG_PATH_ABS + ".tmp"
        with open(tmp, "w") as f:
            f.writelines(kept)
        os.replace(tmp, LOG_PATH_ABS)
        _avail_cache = None
        return removed
    except Exception:
        return 0


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
    global _avail_cache
    response.headers["Cache-Control"] = "max-age=300"
    if _avail_cache and time.monotonic() - _avail_cache[0] < 300:
        return _avail_cache[1]
    logs = _read_logs(24 * 90)

    # bucket logs by day — keep full entries for gap detection
    by_day: dict[str, list[dict]] = defaultdict(list)
    for e in logs:
        try:
            by_day[e["timestamp"][:10]].append(e)
        except Exception:
            continue

    today = datetime.now(timezone.utc).date()
    # Gossip fires every 2 s, so a gap of >5 min means the server was genuinely down.
    GAP_S = 5 * 60
    days = []
    for i in range(89, -1, -1):
        day = (today - timedelta(days=i)).isoformat()
        entries = by_day.get(day, [])
        if not entries:
            days.append({"date": day, "uptime_percent": 100.0, "status": "no_data", "requests": 0, "errors": 0})
            continue

        errors_count = sum(1 for e in entries if e.get("status", 200) >= 500)

        # Detect downtime from gaps between consecutive log entries.
        ts_list = sorted(
            datetime.fromisoformat(e["timestamp"])
            for e in entries if e.get("timestamp")
        )
        downtime_s = sum(
            (ts_list[j] - ts_list[j - 1]).total_seconds()
            for j in range(1, len(ts_list))
            if (ts_list[j] - ts_list[j - 1]).total_seconds() > GAP_S
        )

        gap_pct  = round(max(0.0, (86400.0 - downtime_s) / 86400.0 * 100), 1)
        err_pct  = round((1 - errors_count / len(entries)) * 100, 1)
        pct      = min(gap_pct, err_pct)
        status   = "healthy" if pct >= 99.0 else "degraded" if pct >= 90.0 else "incident"
        days.append({"date": day, "uptime_percent": pct, "status": status, "requests": len(entries), "errors": errors_count})

    all_pcts = [d["uptime_percent"] for d in days if d["status"] != "no_data"]
    avg = round(sum(all_pcts) / len(all_pcts), 2) if all_pcts else 100.0

    result = {
        "days": days,
        "summary": {
            "last_90_days": avg,
            "today": days[-1]["uptime_percent"] if days else 100.0,
        }
    }
    _avail_cache = (time.monotonic(), result)
    return result


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


@router.get("/cluster")
async def cluster_status(response: Response):
    response.headers["Cache-Control"] = "no-store"
    info_tasks = [_cache_cmd(h, p, "INFO") for h, p in _CACHE_NODES]
    # Fetch ring ownership from the first node in parallel with INFO calls
    ring_task = _cache_cmd(_CACHE_NODES[0][0], _CACHE_NODES[0][1], "CLUSTER RING")
    results = await asyncio.gather(*info_tasks, ring_task)
    raw, ring_raw = results[:-1], results[-1]

    nodes = []
    for i, text in enumerate(raw):
        node_id = _CACHE_NODE_IDS[i] if i < len(_CACHE_NODE_IDS) else f"node-{i}"
        if text.startswith("ERR"):
            nodes.append({"id": node_id, "status": "unreachable", "error": text})
            continue
        try:
            info = json.loads(text)
            info["status"] = "alive"
            nodes.append(info)
        except Exception:
            nodes.append({"id": node_id, "status": "unreachable", "error": text})

    ring_ownership: dict = {}
    try:
        ring_ownership = json.loads(ring_raw).get("ownership") or {}
    except Exception:
        pass

    total_keys = sum(n.get("keys_held", 0) for n in nodes if n.get("status") == "alive")
    alive = sum(1 for n in nodes if n.get("status") == "alive")
    return {
        "nodes": nodes,
        "summary": {"alive": alive, "total": len(nodes), "total_keys": total_keys},
        "ring": {"ownership": ring_ownership},
    }


@router.get("/cluster/keys")
async def cluster_keys(response: Response):
    response.headers["Cache-Control"] = "no-store"
    tasks = [_cache_cmd(h, p, "KEYSTATS") for h, p in _CACHE_NODES]
    raw = await asyncio.gather(*tasks)
    keys = []
    for i, text in enumerate(raw):
        node_id = _CACHE_NODE_IDS[i] if i < len(_CACHE_NODE_IDS) else f"node-{i}"
        if text.startswith("ERR"):
            continue
        try:
            node_keys = json.loads(text)
            for key, stat in node_keys.items():
                keys.append({
                    "key": key,
                    "node_id": node_id,
                    "ttl_seconds": int(stat.get("ttl", -1)),
                    "hits": int(stat.get("hits", 0)),
                })
        except Exception:
            continue
    return {"keys": keys}


@router.get("/cluster/key/{key_name:path}")
async def get_key_value(key_name: str, response: Response):
    """Fetch the raw value of a single key (any node will route it correctly)."""
    response.headers["Cache-Control"] = "no-store"
    h, p = _CACHE_NODES[0]
    text = await _cache_cmd(h, p, f"GET {key_name}")
    if text and not text.startswith("ERR") and text != "MISS":
        return {"key": key_name, "value": text}
    return {"key": key_name, "value": None}


@router.post("/cluster/chaos")
async def cluster_chaos(request: Request, response: Response):
    response.headers["Cache-Control"] = "no-store"
    body = await request.json()
    node_id = body.get("node_id", "")
    action = body.get("action", "")

    if node_id not in _CACHE_NODE_IDS:
        raise HTTPException(status_code=400, detail=f"unknown node_id: {node_id!r}")
    if action not in ("stop", "start"):
        raise HTTPException(status_code=400, detail="action must be 'stop' or 'start'")

    prog = f"cache-{node_id}"  # "node-a" → "cache-node-a"
    try:
        proc = await asyncio.create_subprocess_exec(
            "supervisorctl", action, prog,
            stdout=asp.PIPE, stderr=asp.PIPE,
        )
        stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=5.0)
        output = (stdout + stderr).decode().strip()
        return {"ok": proc.returncode == 0, "output": output, "node_id": node_id, "action": action}
    except asyncio.TimeoutError:
        return {"ok": False, "output": "supervisorctl timed out", "node_id": node_id, "action": action}
    except Exception as exc:
        return {"ok": False, "output": str(exc), "node_id": node_id, "action": action}


@router.post("/cluster/rebalance")
async def cluster_rebalance(response: Response):
    response.headers["Cache-Control"] = "no-store"
    tasks = [_cache_cmd(h, p, "MIGRATE") for h, p in _CACHE_NODES]
    raw = await asyncio.gather(*tasks)
    results = {}
    for i, text in enumerate(raw):
        node_id = _CACHE_NODE_IDS[i] if i < len(_CACHE_NODE_IDS) else f"node-{i}"
        results[node_id] = text
    return {"results": results}
