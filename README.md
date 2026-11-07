# AI Chat Assistant

A ChatGPT-style web app: a React SPA talks to a FastAPI REST API, which runs a LangGraph agent on top of OpenAI and stores every conversation in MySQL.

Final project – Full Stack Web Developer course, John Bryce.

**GitHub:** https://github.com/DoronPrigal/ai-chat-assistant

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React + Vite + TypeScript, pure CSS |
| Backend | Python 3.14, FastAPI, Pydantic |
| AI | LangGraph agent, `langchain-openai` (OpenAI is called only from the server) |
| Database | MySQL 8 (Docker), phpMyAdmin |

## Project structure

```
DoronPrigal/
├── Backend/            FastAPI app, LangGraph agent, requirements.txt, Postman collection (planned)
├── Frontend/           React app
├── Database/           MySQL export – db_export.sql (planned)
└── docker-compose.yml  MySQL + phpMyAdmin only
```

## Getting started (Windows / PowerShell)

Requirements: Docker Desktop, Python 3.14, Node.js 20.19 or newer.

### 1. Database

```powershell
docker compose up -d
```

On the very first run MySQL needs about 20–30 seconds to initialize. Wait for it before starting the Backend.

- MySQL: `localhost:3306` (database `chat_db`)
- phpMyAdmin: http://localhost:8080 (user `root`, password from `docker-compose.yml`)

### 2. Backend

```powershell
cd Backend
py -3.14 -m venv env
.\env\Scripts\activate
pip install -r requirements.txt
copy .env.example .env      # then put your OpenAI API key in .env
uvicorn main:app --reload
```

If PowerShell blocks `activate`, run once: `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`.

The API runs on http://localhost:8000. Tables are created automatically on first run.
Interactive docs: http://localhost:8000/docs

### 3. Frontend

```powershell
cd Frontend
npm install
npm run dev
```

Open http://localhost:5173 (the Backend must be running on port 8000).

## API endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/api/health` | Server and database check |
| GET | `/api/conversations` | List conversations, newest first |
| POST | `/api/conversations` | Start a conversation with its first message (created only after the agent answers) |
| GET | `/api/conversations/{id}` | A conversation with all its messages |
| POST | `/api/conversations/{id}/messages` | Send a message and get the agent's reply |
| DELETE | `/api/conversations/{id}` | Delete a conversation and its messages |

## Database design

- `conversations` – one row per chat (`id` is the unique conversation id).
- `messages` – every message, with `role` (`user` / `assistant`) and `conversation_id`.
- `users` – registered users (login and per-user conversations are planned for the next stage).
