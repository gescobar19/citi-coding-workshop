import os

from mangum import Mangum

from app.main import app

# CloudFront routes /api/<service-name>* to this function and forwards the path
# unchanged, so "/api/fastapi-service/health" arrives where FastAPI expects
# "/health" and everything 404s. Mangum strips this prefix before routing, and
# leaves paths that do not carry it alone — so calling the Function URL directly,
# or running under LocalStack at the root, keeps working.
API_BASE_PATH = os.getenv("API_BASE_PATH", "/api/fastapi-service")

handler = Mangum(app, api_gateway_base_path=API_BASE_PATH)
