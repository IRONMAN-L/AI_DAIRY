from datetime import date, datetime
from typing import Literal

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    field_validator,
    model_validator,
)


EntryType = Literal["task", "event", "note"]
EntryStatus = Literal["open", "done", "migrated"]
EntrySource = Literal["typed", "voice", "photo", "pdf"]

MIGRATED_MESSAGE = (
    "Status 'migrated' is set automatically by POST /api/entries/{id}/migrate "
    "and cannot be set manually"
)


class EntryCreate(BaseModel):
    entry_date: date | None = None
    entry_type: EntryType
    title: str | None = Field(default=None, max_length=200)
    content: str = Field(min_length=1)
    status: EntryStatus = "open"
    source: EntrySource = "typed"

    @field_validator("status")
    @classmethod
    def block_manual_migrated(cls, value):
        if value == "migrated":
            raise ValueError(MIGRATED_MESSAGE)
        return value

    @model_validator(mode="after")
    def only_tasks_have_progress(self):
        if self.entry_type != "task" and self.status != "open":
            raise ValueError(
                "Only tasks can be 'done'; events and notes must stay 'open'"
            )
        return self


class EntryUpdate(BaseModel):
    entry_date: date | None = None
    entry_type: EntryType | None = None
    title: str | None = Field(default=None, max_length=200)
    content: str | None = Field(default=None, min_length=1)
    status: EntryStatus | None = None
    source: EntrySource | None = None

    @field_validator("entry_date", "entry_type", "content", "status", "source")
    @classmethod
    def reject_explicit_null(cls, value):
        # These columns are NOT NULL. Omit a field to leave it unchanged;
        # sending null would otherwise reach the database and return a 500.
        if value is None:
            raise ValueError("Cannot be null; omit the field to leave it unchanged")
        return value

    @field_validator("status")
    @classmethod
    def block_manual_migrated(cls, value):
        if value == "migrated":
            raise ValueError(MIGRATED_MESSAGE)
        return value


class EntryResponse(BaseModel):
    id: int
    entry_date: date
    entry_type: str
    title: str | None
    content: str
    status: str
    source: str

    original_date: date | None
    migrated_from_id: int | None
    completed_at: datetime | None

    created_at: datetime
    updated_at: datetime | None

    model_config = ConfigDict(from_attributes=True)


class TaskMigrationRequest(BaseModel):
    target_date: date
