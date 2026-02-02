from datetime import datetime, timezone

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from app.config import ALLOWED_ORIGIN, RATE_LIMIT
from app.db.database import init_db, close_db
from app.middleware.logging import RequestLoggingMiddleware
from app.routers import health, server, github, profile, metrics, discovery

limiter = Limiter(key_func=get_remote_address, default_limits=[f"{RATE_LIMIT}/minute"])

app = FastAPI(
    title="Phoneix API",
    description="Personal API running on a Pixel 7a — server stats, GitHub activity, and more.",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(RequestLoggingMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[ALLOWED_ORIGIN, "http://localhost:*"],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

app.include_router(health.router, prefix="/v1")
app.include_router(server.router, prefix="/v1")
app.include_router(github.router, prefix="/v1")
app.include_router(profile.router, prefix="/v1")
app.include_router(metrics.router, prefix="/v1")
app.include_router(discovery.router, prefix="/v1")


@app.on_event("startup")
async def startup():
    await init_db()


@app.on_event("shutdown")
async def shutdown():
    await close_db()


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={
            "error": "internal_error",
            "message": str(exc),
            "status": 500,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        },
    )


@app.get("/")
async def root():
    return {
        "name": "Phoneix API",
        "version": "1.0.0",
        "docs": "https://api.shubhanmehrotra.com/docs",
        "dashboard": "https://shubhanmehrotra.com",
        "cluster": "https://shubhanmehrotra.com/cluster",
    }
