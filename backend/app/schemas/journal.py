import datetime as dt

from pydantic import BaseModel, Field

from app.schemas.entry import EntryResponse


class JournalStatistics(BaseModel):
    total_entries: int
    total_tasks: int
    completed_tasks: int
    open_tasks: int
    migrated_tasks: int
    total_events: int
    total_notes: int
    completion_percentage: float = Field(
        description=(
            "Done tasks as a percentage of all tasks in the period. "
            "Migrated tasks count in the denominator: they were not finished "
            "in this period."
        )
    )


class DailyActivity(BaseModel):
    date: dt.date
    total_entries: int
    tasks: int
    events: int
    notes: int


class DailyJournalResponse(BaseModel):
    journal_date: dt.date
    statistics: JournalStatistics
    entries: list[EntryResponse]


class RangeJournalResponse(BaseModel):
    start_date: dt.date
    end_date: dt.date
    total_entries: int
    entries: list[EntryResponse]


class WeeklyStatisticsResponse(BaseModel):
    start_date: dt.date
    end_date: dt.date
    statistics: JournalStatistics
    daily_activity: list[DailyActivity]


class MonthlyStatisticsResponse(BaseModel):
    year: int
    month: int
    statistics: JournalStatistics
    daily_activity: list[DailyActivity]
