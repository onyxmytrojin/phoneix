"""
Async TCP client for the Phoneix distributed cache.

Values are base64-encoded before storage so that JSON payloads (which
contain spaces) travel safely over the single-line wire protocol.
The encode/decode is transparent to callers — get/set deal in plain strings.
"""
import asyncio
import base64
import os
from typing import Optional

_raw = os.getenv("CACHE_NODES", "localhost:6001,localhost:6002,localhost:6003")
_NODES = [tuple(n.split(":")) for n in _raw.split(",") if ":" in n]


async def _cmd(command: str, timeout: float = 2.0) -> str:
    if not _NODES:
        return "ERR no nodes configured"
    host, port = _NODES[0]  # consistent hashing routes from any node
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


def _enc(v: str) -> str:
    return base64.b64encode(v.encode()).decode()


def _dec(v: str) -> str:
    try:
        return base64.b64decode(v.encode()).decode()
    except Exception:
        return v  # passthrough if not base64 (e.g. plain test values)


async def get(key: str) -> Optional[str]:
    """Return decoded value for key, or None on miss/error."""
    r = await _cmd(f"GET {key}")
    if r == "MISS" or r.startswith("ERR"):
        return None
    return _dec(r)


async def set(key: str, value: str, ttl: int = 300) -> bool:
    """Store value (base64-encoded) with TTL in seconds. Returns True on OK."""
    r = await _cmd(f"SET {key} {_enc(value)} {ttl}")
    return r == "OK"


async def delete(key: str) -> bool:
    r = await _cmd(f"DEL {key}")
    return r in ("OK", "MISS")


async def ping() -> bool:
    r = await _cmd("PING", timeout=1.0)
    return r.startswith("PONG")
