from fastapi import FastAPI
from chat.router import router as router_messages

app = FastAPI(title="Chat-bot")

app.include_router(router_messages)