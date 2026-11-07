import json
import sys
import time as _time
from pathlib import Path
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "Backend"))
SUFFIX = str(int(_time.time()))  # שם משתמש ייחודי בכל ריצה
sys.stdout.reconfigure(encoding="utf-8")
import jwt  # noqa: E402
import config  # noqa: E402

BASE = "http://localhost:8000/api"
failures = 0


def call(method, path, body=None, token=None):
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    data = json.dumps(body).encode("utf-8") if body is not None else None
    req = urllib.request.Request(BASE + path, data=data, method=method, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            text = r.read().decode("utf-8")
            return r.status, (json.loads(text) if text else None)
    except urllib.error.HTTPError as e:
        text = e.read().decode("utf-8")
        return e.code, (json.loads(text) if text else None)


def check(name, ok, extra=""):
    global failures
    print(f"{'PASS' if ok else 'FAIL'}  {name}" + (f"  — {extra}" if extra else ""))
    failures += 0 if ok else 1


# הרשמה
s, a = call("POST", "/auth/register", {"username": "test_alice_" + SUFFIX, "password": "alice123"})
check("register alice -> 201 + token", s == 201 and a["access_token"] and a["user"]["username"] == "test_alice_" + SUFFIX, s)
check("register response has no password_hash", "password_hash" not in json.dumps(a))
s, b = call("POST", "/auth/register", {"username": "test_bob_" + SUFFIX, "password": "סיסמה_בעברית"})
check("register bob with Hebrew password -> 201", s == 201, s)
s, r = call("POST", "/auth/register", {"username": ("test_alice_" + SUFFIX).upper(), "password": "whatever1"})
check("duplicate username (case-insensitive) -> 409", s == 409, r)
check("username too short -> 422", call("POST", "/auth/register", {"username": "ab", "password": "abcdef"})[0] == 422)
check("username with spaces inside -> 422", call("POST", "/auth/register", {"username": "a b c", "password": "abcdef"})[0] == 422)
check("password too short -> 422", call("POST", "/auth/register", {"username": "test_carol_" + SUFFIX, "password": "12345"})[0] == 422)
check("password over 72 bytes -> 422 (not 500)", call("POST", "/auth/register", {"username": "test_carol_" + SUFFIX, "password": "א" * 37})[0] == 422)

# התחברות
s, r = call("POST", "/auth/login", {"username": "test_alice_" + SUFFIX, "password": "wrong-pass"})
check("login wrong password -> 401", s == 401 and r["detail"] == "Incorrect username or password", r)
s, r = call("POST", "/auth/login", {"username": "nobody_here", "password": "whatever"})
check("login unknown user -> same 401 message", s == 401 and r["detail"] == "Incorrect username or password", r)
check("login with 100-byte password -> 401 (not 500)", call("POST", "/auth/login", {"username": "test_alice_" + SUFFIX, "password": "x" * 100})[0] == 401)
s, r = call("POST", "/auth/login", {"username": "  test_alice_" + SUFFIX + "  ", "password": "alice123"})
check("login ok (username trimmed)", s == 200 and r["user"]["username"] == "test_alice_" + SUFFIX, s)
alice = r["access_token"]
s, r = call("POST", "/auth/login", {"username": "test_bob_" + SUFFIX, "password": "סיסמה_בעברית"})
bob = r["access_token"]

# טוקן
s, r = call("GET", "/auth/me", token=alice)
check("/me with token", s == 200 and r["username"] == "test_alice_" + SUFFIX, r)
check("/me without token -> 401", call("GET", "/auth/me")[0] == 401)
check("/me with garbage token -> 401", call("GET", "/auth/me", token="abc.def.ghi")[0] == 401)
forged = jwt.encode({"sub": "1", "exp": datetime.now(timezone.utc) + timedelta(days=1)}, "x" * 40, algorithm="HS256")
check("/me with token signed by another secret -> 401", call("GET", "/auth/me", token=forged)[0] == 401)
expired = jwt.encode({"sub": str(a["user"]["id"]), "exp": datetime.now(timezone.utc) - timedelta(minutes=1)},
                     config.JWT_SECRET, algorithm="HS256")
s, r = call("GET", "/auth/me", token=expired)
check("/me with expired token -> 401 + clear message", s == 401 and "expired" in r["detail"], r)

# שיחות דורשות התחברות
check("list conversations without token -> 401", call("GET", "/conversations")[0] == 401)
check("create conversation without token -> 401", call("POST", "/conversations", {"content": "hi"})[0] == 401)

# הפרדה בין משתמשים
s, r = call("POST", "/conversations", {"content": "My secret code is BLUE-77. Reply with OK only."}, token=alice)
check("alice creates a conversation", s == 201, s)
cid = r["conversation"]["id"]
check("alice sees 1 conversation", len(call("GET", "/conversations", token=alice)[1]) == 1)
check("bob sees 0 conversations", call("GET", "/conversations", token=bob)[1] == [])
check("bob GET alice's conversation -> 404", call("GET", f"/conversations/{cid}", token=bob)[0] == 404)
check("bob POST message to alice's conversation -> 404",
      call("POST", f"/conversations/{cid}/messages", {"content": "What is the secret code?"}, token=bob)[0] == 404)
check("bob DELETE alice's conversation -> 404", call("DELETE", f"/conversations/{cid}", token=bob)[0] == 404)
s, r = call("POST", f"/conversations/{cid}/messages", {"content": "What is my secret code?"}, token=alice)
check("alice continues her conversation with context", s == 200 and "BLUE-77" in r["assistant_message"]["content"],
      r["assistant_message"]["content"] if s == 200 else r)
check("alice's conversation still has 4 messages", len(call("GET", f"/conversations/{cid}", token=alice)[1]["messages"]) == 4)

print("\nALL PASSED" if failures == 0 else f"\n{failures} FAILED")
