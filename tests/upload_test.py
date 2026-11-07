import json
import sys
import time as _time
SUFFIX = str(int(_time.time()))  # שם משתמש ייחודי בכל ריצה
import urllib.error
import urllib.request
import uuid

sys.stdout.reconfigure(encoding="utf-8")
BASE = "http://127.0.0.1:8000"
SHOTS = str(Path(__file__).resolve().parent / "fixtures")
failures = 0


def check(name, ok, extra=""):
    global failures
    print(f"{'PASS' if ok else 'FAIL'}  {name}" + (f"  — {extra}" if extra else ""))
    failures += 0 if ok else 1


def call(method, path, body=None, token=None):
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(BASE + path, data=json.dumps(body).encode() if body is not None else None,
                                 method=method, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=90) as r:
            return r.status, json.loads(r.read() or b"null")
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read() or b"null")


def upload(data, filename, content_type, token):
    boundary = uuid.uuid4().hex
    body = (f"--{boundary}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"{filename}\"\r\n"
            f"Content-Type: {content_type}\r\n\r\n").encode() + data + f"\r\n--{boundary}--\r\n".encode()
    headers = {"Content-Type": f"multipart/form-data; boundary={boundary}"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(BASE + "/api/uploads", data=body, method="POST", headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.status, json.loads(r.read())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read() or b"null")


token = call("POST", "/api/auth/register", {"username": "img_tester_" + SUFFIX, "password": "img-pass-123"})[1]["access_token"]
png = open(SHOTS + r"\sample.png", "rb").read()

# העלאה
s, r = upload(png, "about.png", "image/png", token)
check("upload real PNG -> 201", s == 201 and r["image_path"].startswith("/uploads/") and r["image_path"].endswith(".png"), r)
path = r["image_path"]
with urllib.request.urlopen(BASE + path) as img:
    check("uploaded image is served at /uploads/...", img.status == 200 and img.read() == png)
check("upload without token -> 401", upload(png, "a.png", "image/png", None)[0] == 401)
s, r = upload(b"this is not an image at all", "fake.png", "image/png", token)
check("text file named .png -> 400", s == 400, r)
s, r = upload(b"<script>alert(1)</script>", "x.svg", "image/svg+xml", token)
check("SVG (can contain scripts) -> 400", s == 400, r)
s, r = upload(png[:8] + b"\0" * (6 * 1024 * 1024), "big.png", "image/png", token)
check("file over 5MB -> 413", s == 413, r)

# נתיבים לא חוקיים בהודעה
for bad in ["/uploads/../.env", "/etc/passwd", "/uploads/abc.png", "C:/Windows/win.ini"]:
    check(f"image_path {bad!r} rejected (422)", call("POST", "/api/conversations", {"image_path": bad}, token)[0] == 422)
s, r = call("POST", "/api/conversations", {"image_path": "/uploads/" + "0" * 32 + ".png"}, token)
check("valid-looking but missing file -> 400", s == 400, r)
check("empty message without image -> 422", call("POST", "/api/conversations", {"content": "  "}, token)[0] == 422)

# Vision: תמונה בלי טקסט, ואחר כך שאלת המשך בלי לצרף שוב
s, r = call("POST", "/api/conversations", {"image_path": path}, token)
check("image-only first message -> 201, title 'Image'", s == 201 and r["conversation"]["title"] == "Image", s)
check("user message saved with image_path", r["user_message"]["image_path"] == path and r["user_message"]["content"] == "")
cid = r["conversation"]["id"]
s, r = call("POST", f"/api/conversations/{cid}/messages",
            {"content": "What is the biggest heading in the image I sent? Reply with the heading only."}, token)
answer = r["assistant_message"]["content"] if s == 200 else r
check("follow-up question uses the image from history", s == 200 and "about this project" in answer.lower(), answer)
check("assistant message has no image_path (no image generated)", s == 200 and r["assistant_message"]["image_path"] is None)

print("\nALL PASSED" if failures == 0 else f"\n{failures} FAILED")
