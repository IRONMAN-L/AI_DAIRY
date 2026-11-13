from sqlalchemy import Column, Integer, String, DateTime
from sqlalchemy.orm import relationship

from app.database.connection import Base
from app.utils.clock import utcnow


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(100), nullable=True)

    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)

    # Relationships
    entries = relationship("Entry", back_populates="user", cascade="all, delete-orphan")

