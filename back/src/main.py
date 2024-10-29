from fastapi import FastAPI
from src.chat.router import router as router_messages
# from src.auth.router import router as router_auth

app = FastAPI(title="Chat-bot")

app.include_router(router_messages)
# app.include_router(router_auth)