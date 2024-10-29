from sqlalchemy import Table, Column, Integer, String, DateTime, func, MetaData

metadata = MetaData()

user = Table(
    'users',
    metadata,
    Column("id", Integer, primary_key=True),
    Column("username", String, nullable=False, unique=True),
    Column("created_at", DateTime, default=func.now())
)