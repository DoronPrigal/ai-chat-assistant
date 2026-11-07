import base64
import sys
from pathlib import Path
from types import SimpleNamespace

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "Backend"))
from fastapi import HTTPException  # noqa: E402
from langchain_core.messages import AIMessage  # noqa: E402

import agent.graph as graph  # noqa: E402
import agent.tools as tools  # noqa: E402
from config import UPLOADS_DIR  # noqa: E402
from images import image_exists, save_image  # noqa: E402
from models.conversation_models import MessageCreate  # noqa: E402
from routes.conversations import save_exchange  # noqa: E402

files_before = set(p.name for p in UPLOADS_DIR.iterdir())


# שירות תמונות מזויף: מחזיר "תמונה" בלי לפנות ל-OpenAI (בלי עלות)
def fake_generate(**kwargs):
    return SimpleNamespace(data=[SimpleNamespace(b64_json=base64.b64encode(b"RIFF0000WEBPfake").decode())])


tools.image_client.images.generate = fake_generate


# מודל מזויף: בקריאה הראשונה מבקש ליצור תמונה, בשנייה מתנהג לפי התרחיש
class FakeModel:
    def __init__(self, second):
        self.calls = 0
        self.second = second

    def invoke(self, messages):
        self.calls += 1
        if self.calls == 1:
            return AIMessage(content="", tool_calls=[{"name": "generate_image", "args": {"prompt": "a cat"}, "id": "call_1"}])
        if self.second == "fail":
            raise RuntimeError("OpenAI failed after the image was created")
        return AIMessage(content="Here is your cat.")


# 1. הסוכן נכשל אחרי שהתמונה נוצרה -> הקובץ נמחק
graph.llm_with_tools = FakeModel("fail")
try:
    graph.get_reply([], "draw a cat")
    print("FAIL  agent failure: no exception")
except RuntimeError:
    new_files = set(p.name for p in UPLOADS_DIR.iterdir()) - files_before
    print(("PASS" if not new_files else "FAIL") + "  agent fails after generating -> generated file deleted", new_files or "")

# 2. ריצה תקינה -> התמונה נשארת ומוחזר הנתיב
graph.llm_with_tools = FakeModel("ok")
reply, path = graph.get_reply([], "draw a cat")
print(("PASS" if path and image_exists(path) and reply == "Here is your cat." else "FAIL") + f"  success -> image kept ({path})")

# 3. השמירה ב-DB נכשלת (השיחה לא קיימת) -> הקובץ נמחק
body = MessageCreate(content="draw a cat")
try:
    save_exchange(999999999, body, reply, path)
    print("FAIL  save failure: no exception")
except HTTPException as error:
    print(("PASS" if not image_exists(path) else "FAIL") + f"  DB save fails ({error.status_code}) -> generated file deleted")

print("leftover files from this test:", set(p.name for p in UPLOADS_DIR.iterdir()) - files_before or "none")
