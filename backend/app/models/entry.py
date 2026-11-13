
from datetime import date

from sqlalchemy import (
    Column,
    Integer,
    String,
    Text,
    Date,
    DateTime,
    ForeignKey
)
from sqlalchemy.orm import relationship

from app.database.connection import Base
from app.utils.clock import utcnow


class Entry(Base):
    __tablename__ = "entries"

    id = Column(Integer, primary_key=True, index=True)

    entry_date = Column(Date, default=date.today, nullable=False)

    entry_type = Column(String(20), nullable=False)

    title = Column(String(200), nullable=True)

    content = Column(Text, nullable=False)

    status = Column(String(20), default="open", nullable=False)

    source = Column(String(20), default="typed", nullable=False)

    # Bullet journal tracking fields
    original_date = Column(Date, nullable=True)

    migrated_from_id = Column(
        Integer,
        ForeignKey("entries.id"),
        nullable=True
    )

    completed_at = Column(DateTime, nullable=True)

    # Multi-tenant user ownership
    user_id = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=True,
        index=True
    )

    user = relationship("User", back_populates="entries")

    created_at = Column(DateTime, default=utcnow)

    updated_at = Column(
        DateTime,
        default=utcnow,
        onupdate=utcnow
    )
