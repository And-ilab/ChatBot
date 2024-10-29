from fastapi import APIRouter


router = APIRouter(
    prefix="/dialogs",
    tags=["Dialogs"]
)


@router.get("/{user_id}/all")
async def get_dialogs(user_id: int):
    return {"message": f"Получить диалоги пользователя с id {user_id}"}


@router.post("/{user_id}/all")
async def new_dialog(user_id: int):
    return {"message": f"Добавить новый диалог для пользователя с id {user_id}"}


@router.post("/{user_id}/{dialog_id}/messages")
async def add_new_message_to_dialog(user_id: int, dialog_id: int):
    return {"message": f"Добавить новое сообщение в диалог {dialog_id} для пользователя {user_id}"}