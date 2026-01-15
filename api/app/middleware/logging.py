import time
import hashlib
import json
import os
from datetime import datetime, timezone

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

LOG_PATH = os.path.join(os.path.dirname(__file__), "../../logs/requests.jsonl")


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        start = time.perf_counter()
        response = await call_next(request)
        duration_ms = round((time.perf_counter() - start) * 1000, 2)

        ip = request.headers.get("CF-Connecting-IP") or request.client.host
        ip_hash = hashlib.sha256(ip.encode()).hexdigest()[:8]

        entry = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "method": request.method,
            "path": request.url.path,
            "status": response.status_code,
            "duration_ms": duration_ms,
            "ip_hash": ip_hash,
        }

        os.makedirs(os.path.dirname(LOG_PATH), exist_ok=True)
        with open(LOG_PATH, "a") as f:
            f.write(json.dumps(entry) + "\n")

        response.headers["X-Response-Time"] = f"{duration_ms}ms"
        return response
