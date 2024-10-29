from fastapi import FastAPI
from chat.router import router as router_messages
from auth.router import router as router_auth

app = FastAPI(title="Chat-bot")

app.include_router(router_messages)
app.include_router(router_auth)
