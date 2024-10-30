from src.chat.schemas import MessageInput
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import insert
from src.models import dialog as dialog_table, message as message_table
from src.database import get_session


router = APIRouter(
    prefix="/dialogs",
    tags=["Dialogs"]
)


@router.get("/{user_id}/dialogs/all")
async def get_dialogs(user_id: int, session: AsyncSession = Depends(get_session)):
    stmt = (
        select(
            dialog_table.c.id,
            message_table.c.sender,
            message_table.c.content
        )
        .join(message_table, message_table.c.dialog_id == dialog_table.c.id)
        .where(dialog_table.c.user_id == user_id)
    )

    result = await session.execute(stmt)
    dialogs_with_messages = result.all()

    if dialogs_with_messages:
        dialogs_dict = {}
        for row in dialogs_with_messages:
            dialog_id = row[0]
            msg = {
                "sender": row[1],
                "content": row[2]
            }

            if dialog_id not in dialogs_dict:
                dialogs_dict[dialog_id] = [msg]
            else:
                dialogs_dict[dialog_id].append(msg)
        return dialogs_dict
    else:
        return {}


@router.post("/{user_id}/dialogs/all")
async def new_dialog(user_id: int, session: AsyncSession = Depends(get_session)):
    stmt = insert(dialog_table).values(user_id=user_id)
    try:
        await session.execute(stmt)
        await session.commit()
        return {"status": 200}
    except SQLAlchemyError as e:
        await session.rollback()
        raise HTTPException(status_code=500, detail=str(e))


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