# 📔 Daybook — Personal AI-Powered Digital Journal

A full-stack personal journaling application with bullet journal support, semantic search, voice dictation, and an AI assistant.

## ✨ Features

- **Daily Journal** — Write and organize entries by date
- **Bullet Journal** — Track tasks with open/done/migrated states
- **Calendar View** — Visual monthly overview with entry counts
- **Semantic Search** — Find entries by meaning, not just keywords
- **AI Assistant** — Chat with your journal using Gemini AI
- **Voice Dictation** — Speak entries directly into the editor
- **Photo OCR** — Extract handwritten text from journal photos
- **Markdown Editor** — Full markdown support with live preview

## 🏗️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite, React Router |
| Backend | FastAPI, Python 3.12, Uvicorn |
| Database | SQLite (via SQLAlchemy + Alembic) |
| Vector Search | ChromaDB + sentence-transformers (all-MiniLM-L6-v2) |
| AI | Google Gemini API |

## 🚀 Local Setup

### 1. Clone the repository
```bash
git clone https://github.com/YOUR_USERNAME/digital-diary.git
cd digital-diary
```

### 2. Backend Setup
```bash
cd backend

# Create virtual environment
python3 -m venv venv
source venv/bin/activate      # Linux/Mac
# venv\Scripts\activate       # Windows

# Install dependencies (~1.8 GB — torch downloads from PyPI)
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env and add your GEMINI_API_KEY

# Run database migrations
alembic upgrade head

# Start the backend server
uvicorn app.main:app --reload --port 8000
```

> **Note:** First startup downloads the `all-MiniLM-L6-v2` model (~90 MB) from HuggingFace automatically. This only happens once.

### 3. Frontend Setup
```bash
cd frontend

# Install dependencies
npm install

# Start the development server
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

## ⚙️ Environment Variables

Copy `backend/.env.example` to `backend/.env` and configure:

| Variable | Required | Description |
|---|---|---|
| `GEMINI_API_KEY` | Yes | Google Gemini API key — get one free at [aistudio.google.com](https://aistudio.google.com/app/apikey) |
| `OPENAI_API_KEY` | No | OpenAI key for GPT-4o fallback on voice/image transcription |

## 📁 Project Structure

```
digital-diary/
├── backend/
│   ├── app/
│   │   ├── routers/        # FastAPI route handlers
│   │   ├── models/         # SQLAlchemy database models
│   │   ├── schemas/        # Pydantic request/response schemas
│   │   ├── services/       # Business logic (AI, search, media)
│   │   └── database/       # DB connection & session management
│   ├── migrations/         # Alembic migration scripts
│   ├── tests/              # pytest test suite
│   ├── requirements.txt    # Python dependencies
│   └── .env.example        # Environment variable template
├── frontend/
│   ├── src/
│   │   ├── pages/          # Route-level page components
│   │   ├── components/     # Reusable UI components
│   │   ├── services/       # API client functions
│   │   ├── context/        # React context providers
│   │   └── utils/          # Date helpers etc.
│   └── package.json
└── .gitignore
```

## 🧪 Running Tests

```bash
cd backend
source venv/bin/activate
pytest                        # runs all 41 tests
```

## 🚢 Deployment

See the deployment notes in `docs/` for VPS deployment instructions.

The backend requires **minimum 2 GB RAM** due to PyTorch for semantic search.

## 📝 License

Personal use project.

