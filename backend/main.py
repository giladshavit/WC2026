from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from api import predictions, admin, matches
from api import groups, teams, knockout, scoring
from database import engine
from models import base, user, team, matches as match_models, predictions as prediction_models
from models import groups as group_models

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
app.include_router(matches.router, prefix="/api", tags=["matches"])
app.include_router(groups.router, prefix="/api", tags=["groups"])
app.include_router(teams.router, prefix="/api", tags=["teams"])
app.include_router(knockout.router, prefix="/api", tags=["knockout"])
app.include_router(scoring.router, prefix="/api/scoring", tags=["scoring"])

# Mount static files
app.mount("/static", StaticFiles(directory="static"), name="static")

@app.get("/")
def read_root():
    return FileResponse("static/index.html")

@app.get("/knockout")
def knockout_page():
    return FileResponse("static/knockout.html")

@app.get("/round16")
def round16_page():
    return FileResponse("static/round16.html")

@app.get("/quarter")
def quarter_page():
    return FileResponse("static/quarter.html")

@app.get("/semi")
def semi_page():
    return FileResponse("static/semi.html")

@app.get("/final")
def final_page():
    return FileResponse("static/final.html")

@app.get("/admin-results")
def admin_results_page():
    return FileResponse("static/admin_results.html")

@app.get("/health")
def health_check():
    return {"status": "healthy"}
