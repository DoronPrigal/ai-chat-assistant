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

If you ran an older version of the project before, reset the database so the tables are created with the current structure: `docker compose down -v` and then `docker compose up -d` (this deletes all local data).

### 2. Backend

```powershell
cd Backend
py -3.14 -m venv env
.\env\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
python -c "import secrets; print(secrets.token_hex(32))"
uvicorn main:app --reload
```

Before starting the server, edit `Backend/.env`:
- `OPENAI_API_KEY` – your OpenAI API key.
- `JWT_SECRET` – paste the random string printed by the `secrets` command above. The server refuses to start without a secret of at least 32 characters.

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

All `/api/conversations` and `/api/uploads` endpoints require `Authorization: Bearer <token>`. Conversations are scoped to the logged-in user (another user's conversation returns 404).

| Method | Path | Description |
|---|---|---|
| GET | `/api/health` | Server and database check |
| POST | `/api/auth/register` | Create an account, returns a JWT |
| POST | `/api/auth/login` | Log in, returns a JWT |
| GET | `/api/auth/me` | The logged-in user |
| GET | `/api/conversations` | List conversations, newest first |
| POST | `/api/conversations` | Start a conversation with its first message (created only after the agent answers) |
| GET | `/api/conversations/{id}` | A conversation with all its messages |
| POST | `/api/conversations/{id}/messages` | Send a message (text and/or `image_path`) and get the agent's reply |
| DELETE | `/api/conversations/{id}` | Delete a conversation, its messages and its image files |
| POST | `/api/uploads` | Upload an image (PNG, JPEG, WebP or GIF, up to 5 MB), returns its `image_path` |
| GET | `/uploads/{file}` | The image file itself (random, unguessable file names) |

## The AI agent

A LangGraph ReAct loop (`agent` node + `tools` node) in `Backend/agent/`:
- **Chat model:** `gpt-6-luna` (OpenAI), the last 20 messages of the conversation are sent as context.
- **Vision:** an attached image is sent to the model together with the text, so you can ask about it.
- **Tools:** `get_current_datetime`, and `generate_image` – creates an image with `gpt-image-1-mini` (1024×1024, low quality, about half a cent per image) when the user asks to draw something.

Images are stored as files in `Backend/uploads/` (not in Git); the database stores only their path.

## Database design

- `users` – registered users. Passwords are stored only as bcrypt hashes.
- `conversations` – one row per chat (`id` is the unique conversation id), owned by a user (`user_id`).
- `messages` – every message, with `role` (`user` / `assistant`), `conversation_id`, and an optional `image_path` (an image the user attached or the agent created).

Deleting a user deletes their conversations, and deleting a conversation deletes its messages (`ON DELETE CASCADE`).
