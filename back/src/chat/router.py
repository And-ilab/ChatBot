from src.chat.schemas import MessageInput, DialogResponse
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import insert
from src.models import message as message_table, dialog as dialog_table
from src.database import get_session


router = APIRouter(
    prefix="/dialogs",
    tags=["Dialogs"]
)

@router.get("/{user_id}/messages", response_model=DialogResponse)
async def get_dialogs(user_id: int, session: AsyncSession = Depends(get_session)):
    stmt = (
        select(
            message_table.c.sender,
            message_table.c.content
        )
        .join(dialog_table, message_table.c.dialog_id == dialog_table.c.id)
        .where(dialog_table.c.user_id == user_id)
    )
    response = await session.execute(stmt)
    rows = response.fetchall()
    messages = [MessageInput(sender=row.sender, content=row.content) for row in rows]
    return DialogResponse(messages=messages)


@router.post("/{user_id}/messages")
async def new_message_to_dialog(
    user_id: int,
    message: MessageInput,
    session: AsyncSession = Depends(get_session)
):
    dialog_id_stmt = select(dialog_table.c.id).where(dialog_table.c.user_id == user_id)
    response_dialog_id = await session.execute(dialog_id_stmt)
    dialog_id = response_dialog_id.scalar_one_or_none()

    stmt = insert(message_table).values(
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


@router.post("/{user_id}")
async def new_dialog(
    user_id: int, session: AsyncSession = Depends(get_session)
):
    existing_dialog_stmt = select(dialog_table).where(dialog_table.c.user_id == user_id)
    result = await session.execute(existing_dialog_stmt)
    existing_dialog = result.scalar_one_or_none()

    if existing_dialog:
        raise HTTPException(status_code=200, detail="Dialog already exists for this user")

    stmt = insert(dialog_table).values(
        user_id=user_id
    )
    try:
        await session.execute(stmt)
        await session.commit()
        raise HTTPException(status_code=200, detail="Dialog added successfully")
    except SQLAlchemyError as e:
        await session.rollback()
        raise HTTPException(status_code=500, detail=str(e))