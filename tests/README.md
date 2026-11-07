# Tests

Manual test scripts used during development. They run against the **real local app**:
MySQL (`docker compose up -d`), the Backend on `http://localhost:8000` and the Frontend on `http://localhost:5173` must be running.

## Setup (once)

```powershell
cd tests
npm install        # playwright-core + axe-core (no browser download: uses the installed Microsoft Edge)
```

Python scripts use the Backend virtual environment (`..\Backend\env`), so they need no extra installs.
No secrets are stored here: scripts that need the JWT secret read it from `Backend/.env` through `Backend/config.py`.

## Run (always from the `tests` folder)

```powershell
node e2e.mjs                                    # browser scripts
..\Backend\env\Scripts\python.exe auth_test.py  # Python scripts
..\Backend\env\Scripts\python.exe cleanup.py    # after testing: delete test users + orphan images
```

Each script prints `PASS` / `FAIL` per check and `ALL PASSED` at the end. Screenshots go to `tests/shots/` (not in Git).

### Browser (Playwright + Edge, headless)

| Script | Checks |
|---|---|
| `e2e.mjs` | Chat with context, sidebar, refresh, dark mode, About, errors + Try again, delete, mobile drawer |
| `auth_ui.mjs` | Register / login / logout, protected pages, two users see only their own chats |
| `auth_fixes_ui.mjs` | Server down on load, expired token, form accessibility |
| `polish_ui.mjs` | Markdown (no raw HTML), user menu (keyboard, Escape, outside click), weather in Hebrew |
| `bonus_ui.mjs` | Streaming (word by word, tool indicator, aria), voice input (mocked), Error Boundary |
| `fixes_ui.mjs <token> <id>` | Last message visible above the input bar, code is LTR. First run `python seed_long_chat.py` (prints the token and id) |
| `drawer_logo.mjs <token>` | Mobile drawer close button position, logo colors |
| `flash_test.mjs` | No re-animation when a streamed answer is saved |
| `responsive.mjs` | No horizontal scroll at 360–1440 px |
| `axe_audit.mjs` | WCAG 2.1 AA (axe-core) on 18 screens, light + dark |
| `images_ui.mjs` | Upload + vision, and **generates one real image (costs ~$0.005)** |

### Python

| Script | Checks |
|---|---|
| `auth_test.py` | Auth API: hashing, JWT (forged / expired), user isolation (404) |
| `auth_fixes_test.py` | Similar login timing, token without `exp`, 422 does not echo passwords |
| `upload_test.py` | Uploads: real/fake images, size limit, path traversal, vision + follow-up |
| `stream_test.py [port]` | Streaming endpoints: NDJSON events, saved text = streamed text, disconnect saves nothing |
| `stream_cleanup_test.py` | Needs a second server with a bad key: `$env:OPENAI_API_KEY='sk-invalid'; ..\Backend\env\Scripts\python.exe -m uvicorn main:app --port 8002` (run in `Backend`). Then error event + image cleanup (simulated, no cost) |
| `orphan_cleanup_test.py` | Generated image is deleted when the agent or the DB save fails (simulated, no cost) |
| `tool_decision_test.py` | An image without text does not trigger image generation |
| `weather_test.py` | `get_weather` tool directly, through the graph and through the API |
| `seed_long_chat.py` | Creates a test user with a long conversation in the DB (no OpenAI calls) |
| `contrast_css.py <css>` | WCAG contrast of all theme colors: `python contrast_css.py ..\Frontend\src\index.css` |
| `cleanup.py` | Deletes test users (by prefix) and image files no message points to. Real users are kept |

## Cost

Most scripts send a few short chat messages (fractions of a cent). Only `images_ui.mjs` generates an image.
Avoid clicking the empty-state suggestions in new tests – one of them asks the agent to draw an image.
