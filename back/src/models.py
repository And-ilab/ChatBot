from sqlalchemy import Table, MetaData, Column, Integer, String, DateTime, func, ForeignKey, Text, CheckConstraint

metadata = MetaData()

user = Table(
    'users',
    metadata,
    Column("id", Integer, primary_key=True),
    Column("username", String, nullable=False, unique=True),
    Column("password_hash", String, nullable=False)
)

message = Table(
    'messages',
    metadata,
    Column("id", Integer, primary_key=True),
    Column("user_id", Integer, ForeignKey("users.id", ondelete="CASCADE")),
    Column("dialog_id", Integer),
    Column("sender", String, nullable=False),
    Column("content", Text, nullable=False),
    CheckConstraint("sender IN ('user', 'bot')", name="check_sender")
)