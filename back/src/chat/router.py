from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import insert
from src.models import dialog, message
from src.database import get_session


router = APIRouter(
    prefix="/dialogs",
    tags=["Dialogs"]
)


@router.get("/{user_id}/all")
async def get_dialogs(user_id: int, session: AsyncSession = Depends(get_session)):
    stmt = (
        select(
            dialog.c.id,
            message.c.sender,
            message.c.content,
            message.c.timestamp
        )
        .join(message, message.c.dialog_id == dialog.c.id)
        .where(dialog.c.user_id == user_id)
    )

    result = await session.execute(stmt)
    dialogs_with_messages = result.all()

    if dialogs_with_messages:
        dialogs_dict = {}
        for row in dialogs_with_messages:
            dialog_id = row[0]
            msg = {
                "sender": row[1],
                "content": row[2],
                "timestamp": row[3]
            }

            if dialog_id not in dialogs_dict:
                dialogs_dict[dialog_id] = [msg]
            else:
                dialogs_dict[dialog_id].append(msg)
        return dialogs_dict
    else:
        return {}


@router.post("/{user_id}/all")
async def new_dialog(user_id: int, started_at: datetime, session: AsyncSession = Depends(get_session)):
    stmt = insert(dialog).values(user_id=user_id, started_at=started_at)
    try:
        result = await session.execute(stmt)

        await session.commit()
        return {"status": 200}
    except SQLAlchemyError as e:
        await session.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{user_id}/{dialog_id}/messages")
async def new_message_to_dialog(user_id: int, dialog_id: int):
    return {"message": f"Добавить новое сообщение в диалог {dialog_id} для пользователя {user_id}"}