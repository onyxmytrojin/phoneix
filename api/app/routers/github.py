"""
GitHub data endpoints with distributed cache + ETag conditional requests.

Cache lifecycle for each endpoint:
  - Within REFRESH_AFTER (5 min): serve from cache, zero GitHub calls.
  - After REFRESH_AFTER: send one ETag conditional request to GitHub.
      304 Not Modified → data unchanged → extend cache, serve from cache.
      200 OK           → data changed  → full refetch, update cache.
  - Cache miss: full unconditional fetch, populate cache.
  - Cache down: fall back to direct GitHub API (graceful degradation).
"""
import asyncio
import json
import time
from collections import defaultdict
from datetime import datetime, timezone

import httpx
from fastapi import APIRouter, Response

from app.config import GITHUB_TOKEN
from app.cache import client as cache

router = APIRouter()

HEADERS = {
    "Authorization": f"token {GITHUB_TOKEN}",
    "Accept": "application/vnd.github.v3+json",
}
USERNAME = "onyxmytrojin"

CACHE_TTL = 3600      # keep entry in distributed cache up to 1 hour
REFRESH_AFTER = 300   # re-verify with GitHub after 5 minutes of age

CK_GITHUB   = "gh:github"
CK_PROJECTS = "gh:projects"
CK_LANGS    = "gh:langs"
CK_ACTIVITY = "gh:activity"


def _time_ago(iso_str: str) -> str:
    try:
        dt = datetime.fromisoformat(iso_str.replace("Z", "+00:00"))
        diff = (datetime.now(timezone.utc) - dt).total_seconds()
        if diff < 3600:
            return f"{int(diff // 60)}m ago"
        if diff < 86400:
            return f"{int(diff // 3600)}h ago"
        return f"{int(diff // 86400)}d ago"
    except Exception:
        return ""


def _public(entry: dict) -> dict:
    """Strip internal _ fields before returning to caller."""
    return {k: v for k, v in entry.items() if not k.startswith("_")}


async def _full_github_fetch() -> tuple[dict, str | None]:
    """Fetch user + repos + commits unconditionally. Returns (data, repos_etag)."""
    async with httpx.AsyncClient(timeout=10, headers=HEADERS) as client:
        user_res, repos_res = await asyncio.gather(
            client.get(f"https://api.github.com/users/{USERNAME}"),
            client.get(f"https://api.github.com/users/{USERNAME}/repos?sort=updated&per_page=10"),
        )

    if user_res.status_code != 200:
        raise RuntimeError(f"GitHub /users returned {user_res.status_code}")

    user = user_res.json()
    repos = repos_res.json() if repos_res.status_code == 200 else []
    repos_etag = repos_res.headers.get("ETag")

    fetch_repos = [r for r in repos[:10] if not r.get("fork")]
    commits = []
    async with httpx.AsyncClient(timeout=10, headers=HEADERS) as client:
        commit_results = await asyncio.gather(*[
            client.get(f"https://api.github.com/repos/{USERNAME}/{r['name']}/commits?per_page=2")
            for r in fetch_repos
        ], return_exceptions=True)
    for repo, c_res in zip(fetch_repos, commit_results):
        if isinstance(c_res, Exception) or c_res.status_code != 200:
            continue
        for c in c_res.json():
            commits.append({
                "repo":     repo["name"],
                "message":  c["commit"]["message"].split("\n")[0][:80],
                "date":     c["commit"]["author"]["date"],
                "time_ago": _time_ago(c["commit"]["author"]["date"]),
                "url":      c["html_url"],
            })

    commits.sort(key=lambda x: x["date"], reverse=True)

    data = {
        "username":      user.get("login"),
        "public_repos":  user.get("public_repos"),
        "followers":     user.get("followers"),
        "avatar_url":    user.get("avatar_url"),
        "recent_commits": commits[:6],
        "profile_url":   user.get("html_url"),
    }
    return data, repos_etag


@router.get("/github")
async def github(response: Response):
    response.headers["Cache-Control"] = "max-age=300"

    # ── 1. Try distributed cache ──────────────────────────────────────────
    raw = await cache.get(CK_GITHUB)
    if raw:
        try:
            entry = json.loads(raw)
            age = time.time() - entry.get("_at", 0)

            if age < REFRESH_AFTER:
                # Fresh enough — serve immediately, no GitHub call.
                return _public(entry)

            # ── 2. Stale cache — ETag conditional check ───────────────────
            etag = entry.get("_repos_etag")
            if etag:
                async with httpx.AsyncClient(timeout=5, headers=HEADERS) as client:
                    check = await client.get(
                        f"https://api.github.com/users/{USERNAME}/repos?sort=updated&per_page=5",
                        headers={"If-None-Match": etag},
                    )
                if check.status_code == 304:
                    # Data unchanged — extend cache TTL and serve.
                    entry["_at"] = time.time()
                    await cache.set(CK_GITHUB, json.dumps(entry, separators=(",", ":")), ttl=CACHE_TTL)
                    return _public(entry)
                # 200 or error → fall through to full refetch below
        except Exception:
            pass  # corrupt cache or network error — fall through

    # ── 3. Full fetch ─────────────────────────────────────────────────────
    try:
        data, repos_etag = await _full_github_fetch()
    except Exception:
        # If fetch fails but we have stale cache, return it rather than erroring.
        if raw:
            try:
                return _public(json.loads(raw))
            except Exception:
                pass
        return {"error": "github_unavailable", "status": 503}

    entry = {**data, "_at": time.time(), "_repos_etag": repos_etag or ""}
    await cache.set(CK_GITHUB, json.dumps(entry, separators=(",", ":")), ttl=CACHE_TTL)
    return data


@router.get("/projects")
async def projects(response: Response):
    response.headers["Cache-Control"] = "max-age=300"

    # ── 1. Try distributed cache ──────────────────────────────────────────
    raw = await cache.get(CK_PROJECTS)
    if raw:
        try:
            entry = json.loads(raw)
            age = time.time() - entry.get("_at", 0)

            if age < REFRESH_AFTER:
                return _public(entry)

            # ── 2. ETag conditional check ─────────────────────────────────
            etag = entry.get("_etag")
            if etag:
                async with httpx.AsyncClient(timeout=5, headers=HEADERS) as client:
                    check = await client.get(
                        f"https://api.github.com/users/{USERNAME}/repos?sort=updated&per_page=10",
                        headers={"If-None-Match": etag},
                    )
                if check.status_code == 304:
                    entry["_at"] = time.time()
                    await cache.set(CK_PROJECTS, json.dumps(entry, separators=(",", ":")), ttl=CACHE_TTL)
                    return _public(entry)
        except Exception:
            pass

    # ── 3. Full fetch ─────────────────────────────────────────────────────
    try:
        async with httpx.AsyncClient(timeout=10, headers=HEADERS) as client:
            res = await client.get(
                f"https://api.github.com/users/{USERNAME}/repos?sort=updated&per_page=10"
            )
        if res.status_code != 200:
            if raw:
                try:
                    return _public(json.loads(raw))
                except Exception:
                    pass
            return {"projects": []}

        projects_list = [
            {
                "name":        r["name"],
                "description": r.get("description") or "",
                "repo":        r["html_url"],
                "stars":       r["stargazers_count"],
                "language":    r.get("language") or "",
                "last_commit": r["updated_at"],
                "time_ago":    _time_ago(r["updated_at"]),
            }
            for r in res.json()
            if not r["fork"]
        ]
        etag = res.headers.get("ETag")
    except Exception:
        if raw:
            try:
                return _public(json.loads(raw))
            except Exception:
                pass
        return {"projects": []}

    data = {"projects": projects_list}
    entry = {**data, "_at": time.time(), "_etag": etag or ""}
    await cache.set(CK_PROJECTS, json.dumps(entry, separators=(",", ":")), ttl=CACHE_TTL)
    return data


@router.get("/langs")
async def langs(response: Response):
    """Language breakdown (% by byte count) across non-fork repos."""
    response.headers["Cache-Control"] = "max-age=300"

    raw = await cache.get(CK_LANGS)
    if raw:
        try:
            entry = json.loads(raw)
            if time.time() - entry.get("_at", 0) < REFRESH_AFTER:
                return _public(entry)
        except Exception:
            pass

    try:
        async with httpx.AsyncClient(timeout=10, headers=HEADERS) as client:
            repos_res = await client.get(
                f"https://api.github.com/users/{USERNAME}/repos?sort=updated&per_page=10"
            )
        if repos_res.status_code != 200:
            raise RuntimeError(f"repos API returned {repos_res.status_code}")

        top_repos = [r["name"] for r in repos_res.json() if not r.get("fork")][:6]

        async with httpx.AsyncClient(timeout=10, headers=HEADERS) as client:
            lang_results = await asyncio.gather(*[
                client.get(f"https://api.github.com/repos/{USERNAME}/{name}/languages")
                for name in top_repos
            ], return_exceptions=True)

        totals: dict[str, int] = defaultdict(int)
        for result in lang_results:
            if not isinstance(result, Exception) and result.status_code == 200:
                for lang, byte_count in result.json().items():
                    totals[lang] += byte_count

        grand_total = sum(totals.values()) or 1
        languages = {
            k: round(v / grand_total * 100, 1)
            for k, v in sorted(totals.items(), key=lambda x: -x[1])[:8]
        }
    except Exception:
        if raw:
            try:
                return _public(json.loads(raw))
            except Exception:
                pass
        return {"languages": {}}

    data = {"languages": languages}
    entry = {**data, "_at": time.time()}
    await cache.set(CK_LANGS, json.dumps(entry, separators=(",", ":")), ttl=CACHE_TTL)
    return data


@router.get("/activity")
async def activity(response: Response):
    """Recent public push/create events."""
    response.headers["Cache-Control"] = "max-age=60"

    raw = await cache.get(CK_ACTIVITY)
    if raw:
        try:
            entry = json.loads(raw)
            if time.time() - entry.get("_at", 0) < 60:
                return _public(entry)
        except Exception:
            pass

    try:
        async with httpx.AsyncClient(timeout=10, headers=HEADERS) as client:
            res = await client.get(
                f"https://api.github.com/users/{USERNAME}/events/public?per_page=30"
            )
        if res.status_code != 200:
            raise RuntimeError(f"events API returned {res.status_code}")

        events = []
        for e in res.json():
            etype = e.get("type", "")
            repo_name = e.get("repo", {}).get("name", "").split("/")[-1]
            if etype == "PushEvent":
                for c in e.get("payload", {}).get("commits", [])[:2]:
                    events.append({
                        "type": "push",
                        "repo": repo_name,
                        "message": c["message"].split("\n")[0][:72],
                        "date": e["created_at"],
                        "time_ago": _time_ago(e["created_at"]),
                    })
            elif etype == "CreateEvent":
                ref_type = e.get("payload", {}).get("ref_type", "branch")
                ref = e.get("payload", {}).get("ref") or ""
                events.append({
                    "type": "create",
                    "repo": repo_name,
                    "message": f"created {ref_type}{' ' + ref if ref else ''}",
                    "date": e["created_at"],
                    "time_ago": _time_ago(e["created_at"]),
                })
            if len(events) >= 10:
                break
    except Exception:
        if raw:
            try:
                return _public(json.loads(raw))
            except Exception:
                pass
        return {"events": []}

    data = {"events": events[:10]}
    entry = {**data, "_at": time.time()}
    await cache.set(CK_ACTIVITY, json.dumps(entry, separators=(",", ":")), ttl=600)
    return data


async def warm_cache():
    """Pre-populate all four GitHub cache keys on startup."""
    await asyncio.sleep(2)  # wait for cache nodes to be reachable
    for fn in (
        lambda: langs(Response()),
        lambda: activity(Response()),
        lambda: projects(Response()),
        lambda: github(Response()),
    ):
        try:
            await fn()
        except Exception:
            pass
