import asyncio
import hashlib
import hmac
import json
import logging

from fastapi import APIRouter, Header, HTTPException, Request

from app.config import GITHUB_WEBHOOK_SECRET

router = APIRouter(prefix="/webhook", tags=["webhook"])
log = logging.getLogger(__name__)

DEPLOY_SCRIPT = "/var/www/phoneix/scripts/deploy.sh"


async def _run_deploy():
    try:
        proc = await asyncio.create_subprocess_exec(
            "bash", DEPLOY_SCRIPT,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.STDOUT,
        )
        stdout, _ = await proc.communicate()
        log.info("deploy finished (exit %s): %s", proc.returncode, stdout.decode()[-500:])
    except Exception as e:
        log.error("deploy script failed: %s", e)


@router.post("/deploy")
async def deploy(
    request: Request,
    x_hub_signature_256: str | None = Header(None),
    x_github_event: str | None = Header(None),
):
    if x_github_event != "push":
        return {"ok": True, "status": "ignored"}

    body = await request.body()

    if not GITHUB_WEBHOOK_SECRET:
        raise HTTPException(500, "GITHUB_WEBHOOK_SECRET not set")

    expected = "sha256=" + hmac.new(
        GITHUB_WEBHOOK_SECRET.encode(), body, hashlib.sha256
    ).hexdigest()
    if not hmac.compare_digest(expected, x_hub_signature_256 or ""):
        raise HTTPException(403, "invalid signature")

    payload = json.loads(body)
    if payload.get("ref") != "refs/heads/main":
        return {"ok": True, "status": "ignored"}

    asyncio.create_task(_run_deploy())
    log.info("deploy triggered by push to main")
    return {"ok": True, "status": "deploying"}
