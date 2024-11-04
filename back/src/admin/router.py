from fastapi import APIRouter, Request

from src.common import templates

router = APIRouter(
    prefix="/admin",
    tags=["Admin"]
)

users = [
    {"name": "User", "ip": "146.120.15.78", "role": "Администратор"},
    {"name": "User", "ip": "135.148.55.132", "role": "Oператор"},
    {"name": "User", "ip": "46.56.162.49", "role": "Oператор"},
    {"name": "User", "ip": "178.124.218.31", "role": "Администратор"},
    {"name": "User", "ip": "178.124.218.31", "role": "Администратор"},
    # Добавьте остальных пользователей
]


@router.get("/")
def home(request: Request):
    return templates.TemplateResponse("users.html", {"request": request, "users": users})
