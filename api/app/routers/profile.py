from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from app.config import API_KEY
from app.db.database import get_db

router = APIRouter()


class NowUpdate(BaseModel):
    project: str
    description: str
    started: str
    tags: list[str] = []


def require_api_key(request: Request):
    key = request.headers.get("X-API-Key")
    if key != API_KEY:
        raise HTTPException(status_code=401, detail="Unauthorized")


@router.get("/now")
async def get_now(response: Response, db=Depends(get_db)):
    response.headers["Cache-Control"] = "max-age=60"
    row = await db.fetchone("SELECT * FROM now ORDER BY updated_at DESC LIMIT 1")
    if not row:
        return {
            "project": "Phoneix",
            "description": "Personal API + distributed cache running on a Pixel 7a",
            "started": "2026-07-06",
            "tags": ["FastAPI", "Go", "Distributed Systems"],
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
    return {
        "project": row["project"],
        "description": row["description"],
        "started": row["started"],
        "tags": row["tags"].split(",") if row["tags"] else [],
        "updated_at": row["updated_at"],
    }


@router.post("/now")
async def update_now(body: NowUpdate, db=Depends(get_db), _=Depends(require_api_key)):
    await db.execute(
        "INSERT INTO now (project, description, started, tags, updated_at) VALUES (?, ?, ?, ?, ?)",
        (body.project, body.description, body.started, ",".join(body.tags),
         datetime.now(timezone.utc).isoformat()),
    )
    return {"status": "updated"}


@router.get("/skills")
async def skills(response: Response):
    response.headers["Cache-Control"] = "max-age=3600"
    return {
        "skills": {
            "languages": ["Python 3", "Go", "TypeScript", "SQL", "Java", "C/C++"],
            "backend": ["FastAPI", "Django", "RESTful APIs", "Microservices", "Event-Driven Architecture"],
            "cloud": ["AWS Lambda", "SQS", "EventBridge", "ECS", "EC2", "IAM", "CloudWatch"],
            "databases": ["PostgreSQL", "MySQL", "DynamoDB", "SQLite", "Redis"],
            "devops": ["Docker", "Nginx", "Cloudflare", "CI/CD", "Linux"],
            "distributed": ["Consistent Hashing", "Gossip Protocol", "Replication"],
        }
    }
