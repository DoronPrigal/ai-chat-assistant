import json
import sys
import time as _time
from pathlib import Path
import time
import urllib.error
import urllib.request

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "Backend"))
SUFFIX = str(int(_time.time()))  # שם משתמש ייחודי בכל ריצה
import jwt  # noqa: E402
import config  # noqa: E402

BASE = "http://localhost:8000/api"


def call(method, path, body=None, token=None):
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(BASE + path, data=json.dumps(body).encode() if body is not None else None,
                                 method=method, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.status, json.loads(r.read() or b"null")
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read() or b"null")


s, a = call("POST", "/auth/register", {"username": "fix_timing_" + SUFFIX, "password": "right-pass-1"})
uid = a["user"]["id"]


def avg_ms(username, n=6):
    times = []
    for _ in range(n):
        t = time.perf_counter()
        call("POST", "/auth/login", {"username": username, "password": "wrong-pass-1"})
        times.append((time.perf_counter() - t) * 1000)
    return sum(times) / n


existing, missing = avg_ms("fix_timing_" + SUFFIX), avg_ms("no_such_user_xyz")
print(f"login time: existing user {existing:.0f}ms | unknown user {missing:.0f}ms | "
      f"{'PASS similar' if abs(existing - missing) < existing * 0.35 else 'FAIL different'}")

no_exp = jwt.encode({"sub": str(uid)}, config.JWT_SECRET, algorithm="HS256")
print("token without exp ->", call("GET", "/auth/me", token=no_exp)[0], "(expect 401)")

s, r = call("POST", "/auth/register", {"username": "fix_echo_" + SUFFIX, "password": "סיסמה-ארוכה" * 10})
print("422 for long password:", s, "| password echoed back:", "סיסמה" in json.dumps(r, ensure_ascii=False), "(expect False)")
