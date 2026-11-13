#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUTPUT="${1:-$ROOT/digital-diary-source.zip}"

# Store only application source/configuration. Explicitly omit private/local data
# even if it is not ignored by Git or is already present in the working tree.
cd "$ROOT"
zip -r "$OUTPUT" \
  app migrations alembic.ini requirements.txt pytest.ini .gitignore package_source.sh \
  -x '*/__pycache__/*' '*.pyc' '*.pyo' \
     '*/venv/*' '*/.venv/*' '*/env/*' \
     '.env' '.env.*' \
     '*.db' '*.db-*' '*.sqlite' '*.sqlite3' '*.backup' \
     'chroma_db/*' '.chroma/*' \
     'uploads/*' \
     '*.zip'

echo "Created source archive: $OUTPUT"
