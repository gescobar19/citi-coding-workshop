from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import (
    allocations,
    auth,
    budgets,
    dashboard,
    deliverables,
    projects,
    resources,
    users,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
app = FastAPI(title="Project Management API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(dashboard.router)
app.include_router(projects.router)
app.include_router(resources.router)
app.include_router(allocations.router)
app.include_router(budgets.router)
app.include_router(deliverables.router)
app.include_router(users.router)


@app.get("/health")
def health():
    return {"status": "ok"}
