from fastapi import FastAPI

from app.api.career import router as career_router
from app.api.demo import router as demo_router
from app.api.staff import router as staff_router
from app.config import get_settings

settings = get_settings()

app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    description="Backend foundation for the Career Navigator employment planning assistant.",
)
app.include_router(demo_router)
app.include_router(career_router)
app.include_router(staff_router)


@app.get("/health", tags=["system"])
async def health_check() -> dict[str, str]:
    """Expose a dependency-free startup check without revealing secrets."""

    return {"status": "ok", "fastgpt_mode": settings.fastgpt_mode}
