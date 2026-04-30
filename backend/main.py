from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

limiter = Limiter(key_func=get_remote_address)

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api import predictions, admin, auth, leagues, download, well_known
from api import bonus as bonus_router
from api import scoring, config
from api.statistics import router as statistics_router
from api.user_view import router as user_view_router
from database import engine
from models import base, user, team, matches as match_models, predictions as prediction_models
from models import groups as group_models
from models import password_reset_token  # noqa: F401 — register PasswordResetToken with Base.metadata
from scheduler import start_scheduler, stop_scheduler

# Create database tables
base.Base.metadata.create_all(bind=engine)


@asynccontextmanager
async def lifespan(app: FastAPI):
    start_scheduler()
    yield
    stop_scheduler()


app = FastAPI(title="World Cup 2026 Predictions API", lifespan=lifespan)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify actual origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers (.well-known must be public and registered before other routes)
app.include_router(well_known.router, prefix="")
app.include_router(download.router, prefix="", tags=["download"])
app.include_router(auth.router, prefix="/api", tags=["auth"])
app.include_router(leagues.router, prefix="/api", tags=["leagues"])
app.include_router(predictions.router, prefix="/api", tags=["predictions"])
app.include_router(bonus_router.router, prefix="/api", tags=["Bonus Predictions"])
app.include_router(admin.router, prefix="/api", tags=["admin"])
app.include_router(scoring.router, prefix="/api/scoring", tags=["scoring"])
app.include_router(config.router, prefix="/api/app", tags=["app"])
app.include_router(statistics_router, prefix="/api", tags=["statistics"])
app.include_router(user_view_router, prefix="/api", tags=["user_view"])


@app.get("/health")
def health_check():
    return {"status": "healthy"}
