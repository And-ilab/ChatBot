from fastapi import FastAPI
from src.chat.router import router as router_messages
from src.auth.router import router as router_auth
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Chat-bot")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # или ["*"] для разрешения всех источников
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router_messages)
# app.include_router(router_auth)