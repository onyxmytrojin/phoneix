from datetime import datetime, timezone

import httpx
from fastapi import APIRouter, Response

from app.config import GITHUB_TOKEN

router = APIRouter()

HEADERS = {"Authorization": f"token {GITHUB_TOKEN}", "Accept": "application/vnd.github.v3+json"}


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

    async with httpx.AsyncClient(timeout=8, headers=HEADERS) as client:
        user_res = await client.get("https://api.github.com/users/onyxmytrojin")
        events_res = await client.get("https://api.github.com/users/onyxmytrojin/events?per_page=30")

    if user_res.status_code != 200:
        return {"error": "github_unavailable", "status": 503}

    user = user_res.json()

    commits = []
    if events_res.status_code == 200:
        for event in events_res.json():
            if event.get("type") == "PushEvent":
                repo = event["repo"]["name"].split("/")[-1]
                for c in event["payload"].get("commits", [])[:2]:
                    commits.append({
                        "repo": repo,
                        "message": c["message"].split("\n")[0][:80],
                        "date": event["created_at"],
                        "time_ago": _time_ago(event["created_at"]),
                        "url": f"https://github.com/{event['repo']['name']}/commit/{c['sha']}",
                    })
                    if len(commits) >= 5:
                        break
            if len(commits) >= 5:
                break

    return {
        "username": user.get("login"),
        "public_repos": user.get("public_repos"),
        "followers": user.get("followers"),
        "recent_commits": commits,
        "profile_url": user.get("html_url"),
    }


@router.get("/projects")
async def projects(response: Response):
    response.headers["Cache-Control"] = "max-age=300"

    async with httpx.AsyncClient(timeout=8, headers=HEADERS) as client:
        res = await client.get("https://api.github.com/users/onyxmytrojin/repos?sort=updated&per_page=10")

    if res.status_code != 200:
        return {"projects": []}

    repos = res.json()
    return {
        "projects": [
            {
                "name": r["name"],
                "description": r.get("description") or "",
                "repo": r["html_url"],
                "stars": r["stargazers_count"],
                "language": r.get("language") or "",
                "last_commit": r["updated_at"],
            }
            for r in repos
            if not r["fork"]
        ]
    }
