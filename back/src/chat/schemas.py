from pydantic import BaseModel
from typing import Literal, Dict, List

class MessageInput(BaseModel):
    sender: Literal['user', 'bot']
    content: str


class DialogResponse(BaseModel):
    messages: List[MessageInput]