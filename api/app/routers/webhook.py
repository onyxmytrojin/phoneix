import asyncio
import hashlib
import hmac
import json
import os

from fastapi import APIRouter, Header, HTTPException, Request

router = APIRouter(prefix="/webhook", tags=["webhook"])

DEPLOY_SCRIPT = "/var/www/phoneix/scripts/deploy.sh"


async def _run_deploy():
    proc = await asyncio.create_subprocess_exec(
        "bash", DEPLOY_SCRIPT,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.STDOUT,
    )
    await proc.communicate()


@router.post("/deploy")
async def deploy(
    request: Request,
    x_hub_signature_256: str | None = Header(None),
    x_github_event: str | None = Header(None),
):
    if x_github_event != "push":
        return {"ok": True, "status": "ignored"}

    body = await request.body()
    payload = json.loads(body)
    if payload.get("ref") != "refs/heads/master":
        return {"ok": True, "status": "ignored"}

    secret = os.environ.get("GITHUB_WEBHOOK_SECRET", "").encode()
    if not secret:
        raise HTTPException(500, "GITHUB_WEBHOOK_SECRET not set")

    expected = "sha256=" + hmac.new(secret, body, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, x_hub_signature_256 or ""):
        raise HTTPException(403, "invalid signature")

    asyncio.create_task(_run_deploy())
    return {"ok": True, "status": "deploying"}
