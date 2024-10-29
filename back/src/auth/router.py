from fastapi import APIRouter, HTTPException
from schemas import UserLogin
from auth import authenticate

router = APIRouter(
    prefix="/auth",
    tags=["Auth"]
)


@app.post('/login')
async def login(user: UserLogin):
    if authenticate(user.username, user.password):
        return HTTPException(status_code=200)
    else:
        return HTTPException(status_code=401)
