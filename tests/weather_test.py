import json
import sys
import time as _time
from pathlib import Path
import urllib.request

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "Backend"))
SUFFIX = str(int(_time.time()))  # שם משתמש ייחודי בכל ריצה
sys.stdout.reconfigure(encoding="utf-8")
from langchain_core.messages import HumanMessage, ToolMessage  # noqa: E402
from agent.graph import agent_app  # noqa: E402
from agent.tools import get_weather  # noqa: E402

# 1. הכלי לבד: עיר לא קיימת
print("unknown city ->", get_weather.invoke({"city": "Qwzxlandia"}))

# 2. דרך הגרף: איזה כלי הופעל ועם איזה קלט
for question in ["מה מזג האוויר במודיעין היום?", "Will it rain in Paris tomorrow?"]:
    result = agent_app.invoke({"messages": [HumanMessage(content=question)]})
    calls = [(c["name"], c["args"]) for m in result["messages"] if getattr(m, "tool_calls", None) for c in m.tool_calls]
    tool_out = [m.text.splitlines()[0] for m in result["messages"] if isinstance(m, ToolMessage)]
    print(f"\nQ: {question}\n  tool calls: {calls}\n  tool result: {tool_out}\n  answer: {result['messages'][-1].text}")

# 3. דרך ה-API (כמו שה-Frontend שולח)
def call(method, path, body=None, token=None):
    headers = {"Content-Type": "application/json", **({"Authorization": f"Bearer {token}"} if token else {})}
    req = urllib.request.Request("http://127.0.0.1:8000/api" + path, data=json.dumps(body).encode() if body else None,
                                 method=method, headers=headers)
    with urllib.request.urlopen(req, timeout=90) as r:
        return r.status, json.loads(r.read())

token = call("POST", "/auth/register", {"username": "wx_tester_" + SUFFIX, "password": "wx-pass-123"})[1]["access_token"]
s, r = call("POST", "/conversations", {"content": "מה מזג האוויר במודיעין היום?"}, token)
print(f"\nAPI {s}: {r['assistant_message']['content']}")
