from src.chat.schemas import MessageInput, DialogResponse
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import insert
from src.models import message as message_table
from src.database import get_session


router = APIRouter(
    prefix="/dialogs",
    tags=["Dialogs"]
)


@router.get("/{user_id}/dialogs", response_model=DialogResponse)
async def get_dialogs(user_id: int, session: AsyncSession = Depends(get_session)):
    query = (
        select(message_table.c.dialog_id, message_table.c.content, message_table.c.sender)
        .where(message_table.c.user_id == user_id)
    )
    result = await session.execute(query)
    dialogs = result.fetchall()

    if dialogs:
        dialogs_dict = {}
        for row in dialogs:
            dialog_id = row[0]
            msg = {
                "sender": row[2],
                "content": row[1]
            }

            if dialog_id not in dialogs_dict:
                dialogs_dict[dialog_id] = [msg]
            else:
                dialogs_dict[dialog_id].append(msg)
        return DialogResponse(dialogs=dialogs_dict)
    else:
        return {}


@router.post("/{user_id}/dialogs/{dialog_id}")
async def new_message_to_dialog(
    user_id: int,
    dialog_id: int,
    message: MessageInput,
    session: AsyncSession = Depends(get_session)
):
    stmt = insert(message_table).values(
        user_id=user_id,
        dialog_id=dialog_id,
        content=message.content,
        sender=message.sender
    )
    try:
        await session.execute(stmt)
        await session.commit()
        return {"status": 200, "detail": "Message added successfully"}
    except SQLAlchemyError as e:
        await session.rollback()
        raise HTTPException(status_code=500, detail=str(e))