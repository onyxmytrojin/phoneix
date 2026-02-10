from datetime import date

from fastapi import APIRouter, Response

from app.config import BIRTHDATE

router = APIRouter()


def _age() -> int:
    dob = date.fromisoformat(BIRTHDATE)
    today = date.today()
    return today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))


@router.get("/cv")
async def cv(response: Response):
    response.headers["Cache-Control"] = "max-age=3600"
    return {
        "name": "Shubhan Mehrotra",
        "age": _age(),
        "title": "Software Engineer | Backend Engineer",
        "location": "Bangalore, India",
        "email": "shubhanmehrotra@gmail.com",
        "github": "https://github.com/onyxmytrojin",
        "linkedin": "https://linkedin.com/in/shubhanmehrotra",
        "portfolio": "https://shubhanmehrotra.com",
        "experience": [
            {
                "company": "Entrupy",
                "role": "Software Engineer I",
                "period": "Jun 2025 – Ongoing",
                "location": "Bengaluru, India",
                "awards": ["Q3 Growth Mindset Award", "Q4 Think Big Award"],
                "highlights": [
                    "Slashed p99 endpoint latency by 95%+ via parallelised multi-pass execution pipeline",
                    "Architected event-driven payment recovery engine using AWS Lambda, SQS FIFO, EventBridge",
                    "Deployed server-side RBAC with JWT token-exchange for row-level data isolation",
                    "FastAPI backend for analytics dashboard serving 10K+ daily users across microservices",
                    "Post-Invoice Reconciliation Engine ensuring 100% financial accuracy via S3 session diffs",
                    "Multi-tenant billing framework for 200+ accounts, reducing overhead by 30%",
                    "Event-driven subscription tracking with 100% message reliability for 50+ monthly upgrades",
                    "DynamoDB GSI design to reduce API latency; test coverage raised from 80% to 88%",
                    "CRM + Slack API integration saving 10+ hours of manual triage weekly",
                ],
            },
            {
                "company": "Entrupy",
                "role": "Python Developer Intern",
                "period": "Oct 2024 – May 2025",
                "highlights": [
                    "Feature flags and ACLs across 4 microservices, reducing manual access updates by 50%",
                    "Automated dual-profile assignment system, halving user onboarding time",
                ],
            },
            {
                "company": "TCS Research",
                "role": "Computing Systems Research Intern",
                "period": "Jun 2024 – Jul 2024",
                "location": "Thane",
                "highlights": [
                    "Preprocessed 50GB+ datasets for RAG training on LLaMA and Mistral, improving throughput 35%",
                    "Reduced distributed training time by 27.5% on high-compute clusters",
                ],
            },
        ],
        "education": [
            {
                "degree": "B.Tech. Electrical Engineering",
                "institution": "Indian Institute of Technology Palakkad",
                "year": "2021–2025",
                "grade": "7.85 CGPA",
            },
            {
                "degree": "Senior Secondary",
                "institution": "CBSE Board",
                "year": "2021",
                "grade": "90.8%",
            },
        ],
        "skills": {
            "languages": ["Python 3", "Go", "TypeScript", "SQL", "Java", "C/C++"],
            "backend": ["FastAPI", "Django", "REST", "Microservices", "Event-Driven Architecture"],
            "cloud": ["AWS Lambda", "SQS", "EventBridge", "ECS", "EC2", "IAM", "CloudWatch"],
            "databases": ["PostgreSQL", "MySQL", "DynamoDB", "SQLite", "Redis"],
            "devops": ["Docker", "Nginx", "Cloudflare", "CI/CD", "Linux"],
            "distributed": ["Consistent Hashing", "Gossip Protocol", "Replication"],
        },
    }


@router.get("/uses")
async def uses(response: Response):
    response.headers["Cache-Control"] = "max-age=3600"
    return {
        "hardware": {
            "server": "Google Pixel 7a (8GB RAM, 128GB, ARM64 Tensor G2)",
            "dev_machine": "Windows 11 laptop",
        },
        "os": {
            "server": "GrapheneOS + Debian Linux via proot-distro",
            "dev": "Windows 11",
        },
        "editor": "VS Code",
        "server_stack": {
            "reverse_proxy": "Nginx",
            "tunnel": "Cloudflare Tunnel",
            "process_manager": "nohup + bash startup script",
            "ssh": "OpenSSH (Dropbear inside proot)",
        },
        "api_stack": {
            "framework": "FastAPI",
            "server": "Uvicorn",
            "database": "SQLite via aiosqlite",
            "http_client": "httpx",
        },
    }


@router.get("/stack")
async def stack(response: Response):
    response.headers["Cache-Control"] = "max-age=3600"
    return {
        "stack": [
            {"name": "FastAPI", "role": "API framework", "url": "https://fastapi.tiangolo.com"},
            {"name": "Go", "role": "Distributed cache (Part 2)", "url": "https://go.dev"},
            {"name": "Nginx", "role": "Reverse proxy", "url": "https://nginx.org"},
            {"name": "Cloudflare Tunnel", "role": "Public HTTPS access without open ports", "url": "https://developers.cloudflare.com/cloudflare-one/connections/connect-networks"},
            {"name": "GrapheneOS", "role": "Phone OS", "url": "https://grapheneos.org"},
            {"name": "proot-distro", "role": "Debian Linux on Android", "url": "https://github.com/termux/proot-distro"},
            {"name": "SQLite", "role": "Lightweight database", "url": "https://sqlite.org"},
            {"name": "Uvicorn", "role": "ASGI server", "url": "https://www.uvicorn.org"},
        ]
    }
