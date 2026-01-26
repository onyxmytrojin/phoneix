import time
import shutil
from datetime import datetime, timezone

from fastapi import APIRouter, Response

router = APIRouter()


def _read_cpu_percent() -> float:
    def read_stat():
        try:
            with open("/proc/stat") as f:
                line = f.readline()
            vals = list(map(int, line.split()[1:]))
            idle = vals[3]
            total = sum(vals)
            return idle, total
        except Exception:
            return 0, 1

    idle1, total1 = read_stat()
    time.sleep(0.1)
    idle2, total2 = read_stat()

    delta_total = total2 - total1
    delta_idle = idle2 - idle1
    if delta_total == 0:
        return 0.0
    return round((1 - delta_idle / delta_total) * 100, 1)


def _read_memory():
    info = {}
    try:
        with open("/proc/meminfo") as f:
            for line in f:
                key, val = line.split(":")
                info[key.strip()] = int(val.split()[0])
    except Exception:
        return {"total_gb": 0, "used_gb": 0, "available_gb": 0, "percent_used": 0}

    total_kb = info.get("MemTotal", 0)
    available_kb = info.get("MemAvailable", 0)
    used_kb = total_kb - available_kb

    total_gb = round(total_kb / (1024 ** 2), 2)
    available_gb = round(available_kb / (1024 ** 2), 2)
    used_gb = round(used_kb / (1024 ** 2), 2)
    percent = round((used_kb / total_kb) * 100, 1) if total_kb else 0

    return {
        "total_gb": total_gb,
        "used_gb": used_gb,
        "available_gb": available_gb,
        "percent_used": percent,
    }


def _read_uptime():
    try:
        with open("/proc/uptime") as f:
            secs = float(f.read().split()[0])
        days, rem = divmod(int(secs), 86400)
        hours, rem = divmod(rem, 3600)
        mins = rem // 60
        parts = []
        if days:
            parts.append(f"{days}d")
        if hours:
            parts.append(f"{hours}h")
        parts.append(f"{mins}m")
        return secs, " ".join(parts)
    except Exception:
        return 0.0, "unknown"


def _read_load():
    try:
        with open("/proc/loadavg") as f:
            parts = f.read().split()
        return [float(parts[0]), float(parts[1]), float(parts[2])]
    except Exception:
        return [0.0, 0.0, 0.0]


@router.get("/server")
async def server_stats(response: Response):
    response.headers["Cache-Control"] = "no-store"

    cpu = _read_cpu_percent()
    mem = _read_memory()
    uptime_secs, uptime_human = _read_uptime()
    load = _read_load()

    try:
        disk = shutil.disk_usage("/")
        disk_info = {
            "total_gb": round(disk.total / (1024 ** 3), 1),
            "used_gb": round(disk.used / (1024 ** 3), 1),
            "free_gb": round(disk.free / (1024 ** 3), 1),
        }
    except Exception:
        disk_info = {"total_gb": 0, "used_gb": 0, "free_gb": 0}

    return {
        "cpu_percent": cpu,
        "memory": mem,
        "disk": disk_info,
        "uptime_seconds": uptime_secs,
        "uptime_human": uptime_human,
        "load_avg": load,
        "hardware": "Google Pixel 7a",
        "arch": "ARM64",
        "os": "Debian Linux (proot)",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
