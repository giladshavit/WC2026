from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api import predictions, admin
from .database import engine
from .models import base, user, team, matches as match_models, predictions as prediction_models

# Create database tables
base.Base.metadata.create_all(bind=engine)

app = FastAPI(title="World Cup 2026 Predictions API")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify actual origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(predictions.router, prefix="/api", tags=["predictions"])
app.include_router(admin.router, prefix="/api", tags=["admin"])

@app.get("/")
def read_root():
    return {"message": "World Cup 2026 Predictions API"}

@app.get("/health")
def health_check():
    return {"status": "healthy"}
