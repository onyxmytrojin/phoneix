import os
import shutil
import time
from datetime import datetime, timezone

from fastapi import APIRouter, Response

router = APIRouter()

# /proc/uptime is frozen in proot; capture it at startup and add real elapsed time
_UPTIME_AT_START: float = 0.0
_CLOCK_AT_START: float = time.time()
try:
    with open("/proc/uptime") as _f:
        _UPTIME_AT_START = float(_f.read().split()[0])
except Exception:
    pass


def _read_cpu_percent() -> float:
    # /proc/stat is frozen in proot-distro; derive CPU load from loadavg + freq
    try:
        with open("/proc/loadavg") as f:
            load_1min = float(f.read().split()[0])

        # frequency-based boost: average efficiency cores (cpu0-3) cur/max
        freq_sum, freq_n = 0.0, 0
        for cpu_id in range(4):
            try:
                cur = int(open(f"/sys/devices/system/cpu/cpu{cpu_id}/cpufreq/scaling_cur_freq").read())
                max_f = int(open(f"/sys/devices/system/cpu/cpu{cpu_id}/cpufreq/cpuinfo_max_freq").read())
                if max_f > 0:
                    freq_sum += cur / max_f
                    freq_n += 1
            except Exception:
                continue

        ncpu = 6  # cores visible in proot on Pixel 7a
        load_pct = min(100.0, (load_1min / ncpu) * 100)
        freq_pct = (freq_sum / freq_n * 100) if freq_n else load_pct
        return round(0.5 * load_pct + 0.5 * freq_pct, 1)
    except Exception:
        return 0.0


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
        secs = _UPTIME_AT_START + (time.time() - _CLOCK_AT_START)
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
        la = os.getloadavg()
        return [round(la[0], 2), round(la[1], 2), round(la[2], 2)]
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
