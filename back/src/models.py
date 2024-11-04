from sqlalchemy import Table, MetaData, Column, Integer, String, DateTime, func, ForeignKey, Text, CheckConstraint, Enum

metadata = MetaData()

user = Table(
    'users',
    metadata,
    Column("id", Integer, primary_key=True),
    Column("username", String, nullable=False, unique=True),
    Column("password_hash", String, nullable=False)
)

user_table = Table(
    'admins',
    metadata,
    Column('id', Integer, primary_key=True),
    Column('first_name', String(50), nullable=False),
    Column('last_name', String(50), nullable=False),
    Column('email', String(120), nullable=False, unique=True),
    Column('role', Enum('admin', 'operator', name='role_enum'), nullable=False),
    Column("password_hash", String, nullable=False)
)

dialog = Table(
    'dialogs',
    metadata,
    Column("id", Integer, primary_key=True),
    Column("user_id", Integer, ForeignKey("users.id", ondelete="CASCADE")),
)

message = Table(
    'messages',
    metadata,
    Column("id", Integer, primary_key=True),
    Column("dialog_id", Integer, ForeignKey("dialogs.id", ondelete="CASCADE")),
    Column("sender", String, nullable=False),
    Column("content", Text, nullable=False),
    CheckConstraint("sender IN ('user', 'bot')", name="check_sender")
)