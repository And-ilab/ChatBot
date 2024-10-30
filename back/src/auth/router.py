from fastapi import APIRouter, HTTPException, Depends
from src.auth.schemas import UserLogin
from src.auth.auth import authenticate

from src.auth.auth import get_current_user
from src.auth.auth import create_access_token

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


@router.post('/login_new')
async def login(user: UserLogin):
    user_info = authenticate(user.username, user.password)
    if user_info:
        # Создание токена
        access_token = create_access_token(data={"sub": user_info["username"], "roles": user_info["roles"]})
        return {"access_token": access_token, "token_type": "bearer"}
    else:
        raise HTTPException(status_code=401, detail="Invalid credentials")

@router.get('/protected')
async def protected_route(current_user: dict = Depends(get_current_user)):
    username = current_user.get("sub")
    roles = current_user.get("roles")
    return {"username": username, "roles": roles}
