import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

from config import settings
from routes import applicants, auth, placed, students
from services.database_service import close_db_pool, init_db, open_db_pool

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_: FastAPI):
    open_db_pool()
    init_db()
    logger.info("PostgreSQL database initialized")
    try:
        yield
    finally:
        close_db_pool()


app = FastAPI(
    title="Internship Manager API",
    description="Manage internship applicants and filter out already placed students",
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_allowed_origins,
    allow_origin_regex=settings.cors_allow_origin_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(GZipMiddleware, minimum_size=settings.gzip_minimum_size)

app.include_router(auth.router)
app.include_router(applicants.router)
app.include_router(placed.router)
app.include_router(students.router)


@app.get("/")
def root():
    return {"status": "ok", "message": "Internship Manager API is running"}


@app.get("/health")
def health():
    return {"status": "healthy"}
