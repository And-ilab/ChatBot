from fastapi import APIRouter, HTTPException
from src.auth.schemas import UserLogin
from src.auth import authenticate

router = APIRouter(
    prefix="/auth",
    tags=["Auth"]
)


@router.post('/login')
async def login(user: UserLogin):
    if authenticate(user.username, user.password):
        return {"status": 200, "message": "Successfully logged in."}
    else:
        return {"status": 401, "message": "Something went wrong."}
