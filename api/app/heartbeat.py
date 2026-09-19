import asyncio
import os
from datetime import datetime, timedelta, timezone

HEARTBEAT_PATH = os.path.join(os.path.dirname(__file__), "../logs/heartbeat.jsonl")
HEARTBEAT_INTERVAL_S = 60


def _write_beat() -> None:
    os.makedirs(os.path.dirname(HEARTBEAT_PATH), exist_ok=True)
    with open(HEARTBEAT_PATH, "a") as f:
        f.write(datetime.now(timezone.utc).isoformat() + "\n")


async def heartbeat_loop() -> None:
    """Append a timestamp every minute. Gaps in this file are what the
    availability endpoint treats as downtime (see availability.py)."""
    while True:
        try:
            _write_beat()
        except Exception:
            pass
        await asyncio.sleep(HEARTBEAT_INTERVAL_S)


def read_heartbeats(hours: int) -> list[datetime]:
    cutoff = datetime.now(timezone.utc) - timedelta(hours=hours)
    beats: list[datetime] = []
    try:
        with open(HEARTBEAT_PATH) as f:
            for line in f:
                try:
                    ts = datetime.fromisoformat(line.strip())
                except ValueError:
                    continue
                if ts >= cutoff:
                    beats.append(ts)
    except FileNotFoundError:
        pass
    return beats


def rotate_heartbeats(keep_days: int = 90) -> int:
    """Drop beats older than keep_days, atomically. Returns how many were removed."""
    cutoff = datetime.now(timezone.utc) - timedelta(days=keep_days)
    try:
        with open(HEARTBEAT_PATH) as f:
            lines = f.readlines()
    except FileNotFoundError:
        return 0
    kept = []
    for line in lines:
        try:
            if datetime.fromisoformat(line.strip()) >= cutoff:
                kept.append(line)
        except ValueError:
            continue
    removed = len(lines) - len(kept)
    if removed:
        tmp = HEARTBEAT_PATH + ".tmp"
        with open(tmp, "w") as f:
            f.writelines(kept)
        os.replace(tmp, HEARTBEAT_PATH)
    return removed
