import sys
from logging.config import fileConfig
from pathlib import Path

from alembic import context

config = context.config
# Resolve the project root from alembic.ini, not the shell's current directory.
project_root = (
    Path(config.config_file_name).resolve().parent
    if config.config_file_name
    else Path(__file__).resolve().parents[1]
)
if str(project_root) not in sys.path:
    sys.path.insert(0, str(project_root))

from app.database.connection import DATABASE_URL, engine, Base
from app.models.entry import Entry  # noqa: E402,F401 - register model metadata

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Keep Alembic's offline URL and online engine aligned with the application.
# Escape percent signs because Config uses ConfigParser interpolation.
config.set_main_option("sqlalchemy.url", DATABASE_URL.replace("%", "%%"))
target_metadata = Base.metadata


def run_migrations_offline() -> None:
    context.configure(
        url=DATABASE_URL,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    # Reuse the same Engine/path as FastAPI instead of rebuilding one from
    # alembic.ini (whose relative URL depends on the working directory).
    with engine.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
