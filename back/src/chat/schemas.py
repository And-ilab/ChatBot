from pydantic import BaseModel
from typing import Literal

class MessageInput(BaseModel):
    content: str
    sender: Literal['user', 'bot']
