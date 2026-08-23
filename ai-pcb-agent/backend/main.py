from __future__ import annotations

import os
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from dotenv import load_dotenv

load_dotenv()

import db
from routes import pcb, manufacturing, orders, agent

app = FastAPI(
    title="AI PCB Manufacturing Agent",
    description="Agentic AI backend that analyzes PCBs, runs DFM checks, and "
                "compares manufacturers. Payments are handled separately by "
                "the Node x402 service (Algorand Testnet via GoPlausible); "
                "this service handles no money.",
    version="1.0.0",
)

origins = os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    db.init_db()


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    # Never leak raw stack traces to the client.
    return JSONResponse(
        status_code=500,
        content={"error": "internal_error", "message": "Something went wrong processing your request. Please try again."},
    )


app.include_router(pcb.router)
app.include_router(manufacturing.router)
app.include_router(orders.router)
app.include_router(agent.router)


@app.get("/")
async def root():
    return {"status": "ok", "service": "AI PCB Manufacturing Agent", "agent_status": "online"}


@app.get("/api/health")
async def health():
    return {"status": "healthy"}
