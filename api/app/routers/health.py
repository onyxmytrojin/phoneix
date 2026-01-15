import time
import shutil
from datetime import datetime, timezone

import httpx
from fastapi import APIRouter, Response

from app.config import GITHUB_TOKEN

router = APIRouter()


def _uptime_human(seconds: float) -> str:
    seconds = int(seconds)
    days, rem = divmod(seconds, 86400)
    hours, rem = divmod(rem, 3600)
    mins = rem // 60
    parts = []
    if days:
        parts.append(f"{days}d")
    if hours:
        parts.append(f"{hours}h")
    parts.append(f"{mins}m")
    return " ".join(parts)


def _read_uptime() -> float:
    try:
        with open("/proc/uptime") as f:
            return float(f.read().split()[0])
    except Exception:
        return 0.0


def _disk_free_gb() -> str:
    try:
        usage = shutil.disk_usage("/")
        return f"{usage.free / (1024 ** 3):.1f}GB free"
    except Exception:
        return "unknown"


def _memory_available() -> str:
    try:
        with open("/proc/meminfo") as f:
            for line in f:
                if line.startswith("MemAvailable:"):
                    kb = int(line.split()[1])
                    return f"{kb / (1024 ** 2):.1f}GB"
    except Exception:
        pass
    return "unknown"


async def _github_reachable() -> str:
    try:
        headers = {"Authorization": f"token {GITHUB_TOKEN}"} if GITHUB_TOKEN else {}
        async with httpx.AsyncClient(timeout=5) as client:
            r = await client.get("https://api.github.com/zen", headers=headers)
            return "reachable" if r.status_code == 200 else f"error {r.status_code}"
    except Exception:
        return "unreachable"


@router.get("/ping")
async def ping(response: Response):
    response.headers["Cache-Control"] = "no-store"
    start = time.perf_counter()
    ts = datetime.now(timezone.utc).isoformat()
    elapsed = round((time.perf_counter() - start) * 1000, 2)
    return {"pong": True, "response_ms": elapsed, "timestamp": ts}


@router.get("/health")
async def health(response: Response):
    response.headers["Cache-Control"] = "no-store"

    uptime_secs = _read_uptime()
    github_status = await _github_reachable()

    status = "healthy" if github_status == "reachable" else "degraded"
    http_status = 200 if status == "healthy" else 503

    body = {
        "status": status,
        "checks": {
            "github_api": github_status,
            "disk_space": _disk_free_gb(),
            "memory_available": _memory_available(),
            "uptime": _uptime_human(uptime_secs),
        },
        "version": "1.0.0",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

    response.status_code = http_status
    return body
