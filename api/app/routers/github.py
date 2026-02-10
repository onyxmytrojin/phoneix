import asyncio
from datetime import datetime, timezone

import httpx
from fastapi import APIRouter, Response

from app.config import GITHUB_TOKEN

router = APIRouter()

HEADERS = {"Authorization": f"token {GITHUB_TOKEN}", "Accept": "application/vnd.github.v3+json"}
USERNAME = "onyxmytrojin"


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


@router.get("/github")
async def github(response: Response):
    response.headers["Cache-Control"] = "max-age=300"

    async with httpx.AsyncClient(timeout=10, headers=HEADERS) as client:
        user_res, repos_res = await asyncio.gather(
            client.get(f"https://api.github.com/users/{USERNAME}"),
            client.get(f"https://api.github.com/users/{USERNAME}/repos?sort=updated&per_page=5"),
        )

    if user_res.status_code != 200:
        return {"error": "github_unavailable", "status": 503}

    user = user_res.json()
    repos = repos_res.json() if repos_res.status_code == 200 else []

    commits = []
    async with httpx.AsyncClient(timeout=10, headers=HEADERS) as client:
        for repo in repos[:5]:
            if repo.get("fork"):
                continue
            c_res = await client.get(
                f"https://api.github.com/repos/{USERNAME}/{repo['name']}/commits?per_page=2"
            )
            if c_res.status_code == 200:
                for c in c_res.json():
                    commits.append({
                        "repo": repo["name"],
                        "message": c["commit"]["message"].split("\n")[0][:80],
                        "date": c["commit"]["author"]["date"],
                        "time_ago": _time_ago(c["commit"]["author"]["date"]),
                        "url": c["html_url"],
                    })
            if len(commits) >= 6:
                break

    commits.sort(key=lambda x: x["date"], reverse=True)

    return {
        "username": user.get("login"),
        "public_repos": user.get("public_repos"),
        "followers": user.get("followers"),
        "avatar_url": user.get("avatar_url"),
        "recent_commits": commits[:6],
        "profile_url": user.get("html_url"),
    }


@router.get("/projects")
async def projects(response: Response):
    response.headers["Cache-Control"] = "max-age=300"

    async with httpx.AsyncClient(timeout=10, headers=HEADERS) as client:
        res = await client.get(
            f"https://api.github.com/users/{USERNAME}/repos?sort=updated&per_page=10"
        )

    if res.status_code != 200:
        return {"projects": []}

    return {
        "projects": [
            {
                "name": r["name"],
                "description": r.get("description") or "",
                "repo": r["html_url"],
                "stars": r["stargazers_count"],
                "language": r.get("language") or "",
                "last_commit": r["updated_at"],
                "time_ago": _time_ago(r["updated_at"]),
            }
            for r in res.json()
            if not r["fork"]
        ]
    }
