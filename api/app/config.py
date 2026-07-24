from dotenv import load_dotenv
import os

load_dotenv()

GITHUB_TOKEN = os.getenv("GITHUB_TOKEN", "")
API_KEY = os.getenv("API_KEY", "")
ENVIRONMENT = os.getenv("ENVIRONMENT", "development")
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")
RATE_LIMIT = int(os.getenv("RATE_LIMIT", "100"))
BIRTHDATE = os.getenv("BIRTHDATE", "2003-03-17")
GITHUB_WEBHOOK_SECRET = os.getenv("GITHUB_WEBHOOK_SECRET", "")

ALLOWED_ORIGIN = (
    "https://shubhanmehrotra.com"
    if ENVIRONMENT == "production"
    else "http://localhost:3000"
)
