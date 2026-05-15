# SupportIQ

SupportIQ is a full-stack AI support assistant that lets companies upload documents, build a knowledge base, and deliver customer support through an AI-powered chat experience.

Live demo: https://supportiq2026.vercel.app/

## Tech Stack

- Frontend: React 19, Vite, Tailwind CSS, shadcn/ui, React Router
- Backend: FastAPI, Uvicorn, Python
- AI/RAG: LangChain, OpenRouter
- Auth/Data: Supabase

## Usage

### 1) Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

Create a `.env` file in `backend/` with the required credentials (for example, Supabase and OpenRouter keys).

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 2) Frontend

```bash
cd frontend
npm install
npm run dev
```

Set the API base URL in `frontend/.env`:

```bash
VITE_API_BASE_URL=http://localhost:8000
```

Open http://localhost:5173 in your browser.
