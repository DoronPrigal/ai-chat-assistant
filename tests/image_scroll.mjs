// באג הגלילה עם תמונה שנוצרה: ההודעה האחרונה (עם התמונה) צריכה להיות גלויה כולה מעל שורת ההקלדה.
// בלי עלות: ה-Streaming מדומה בדפדפן (בלי OpenAI), והתמונה נוצרת ב-canvas ומועלית למשתמש בדיקה.
// הרצה: node image_scroll.mjs   (צריך MySQL, Backend על 8000 ו-Frontend על 5173)
import { execSync } from "node:child_process";
import { chromium } from "playwright-core";

const URL = "http://localhost:5173";
const API = "http://localhost:8000/api";
const SHOTS = "./shots/";
let failures = 0;
const check = (name, ok, extra = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  — " + extra : ""}`);
  if (!ok) failures++;
};

// משתמש בדיקה (scroll_) עם שיחה ארוכה ב-DB
const seed = JSON.parse(execSync("..\\Backend\\env\\Scripts\\python.exe seed_long_chat.py").toString().trim().split("\n").at(-1));
const { token, cid } = seed;

// ההודעה האחרונה כולה מעל שורת ההקלדה, והדף בסוף
const lastVisible = (p) => p.evaluate(() => {
  const last = [...document.querySelectorAll(".message-list .message")].at(-1).getBoundingClientRect();
  const input = document.querySelector(".chat-input").getBoundingClientRect();
  const root = document.documentElement;
  const gap = Math.round(root.scrollHeight - (window.innerHeight + window.scrollY));
  return { ok: last.bottom <= input.top + 1 && gap <= 1, lastBottom: Math.round(last.bottom), inputTop: Math.round(input.top), gap };
});

// מחכים שהתמונה האחרונה נטענה, ועוד קצת לגלילה ולאנימציה
async function waitForImage(p) {
  await p.waitForFunction(() => {
    const img = [...document.querySelectorAll(".message-list img")].at(-1);
    return img && img.complete && img.naturalWidth > 0;
  }, null, { timeout: 15000 });
  await p.waitForTimeout(500);
}

const browser = await chromium.launch({ channel: "msedge", headless: true });

// מעלים תמונה של 1024x1024 (כמו תמונה שהסוכן יוצר)
const setup = await browser.newPage();
await setup.goto(URL + "/about");
const imagePath = await setup.evaluate(async ({ api, token }) => {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 1024;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#256B61";
  ctx.fillRect(0, 0, 1024, 1024);
  ctx.fillStyle = "#DED6C8";
  ctx.fillRect(256, 256, 512, 512);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
  const form = new FormData();
  form.append("file", blob, "test.png");
  const res = await fetch(api + "/uploads", { method: "POST", headers: { Authorization: "Bearer " + token }, body: form });
  return (await res.json()).image_path;
}, { api: API, token });
await setup.close();
check("test image uploaded", typeof imagePath === "string" && imagePath.startsWith("/uploads/"), imagePath);

const now = new Date().toISOString();
const userMsg = (id, conv) => ({ id, conversation_id: conv, role: "user", content: "Draw a dog riding a bicycle", image_path: null, created_at: now });
const imageMsg = (id, conv) => ({ id, conversation_id: conv, role: "assistant", content: "Here is a dog riding a bicycle! 🐶🚲", image_path: imagePath, created_at: now });

// כל מסך פעמיים: תמונה שנטענת מיד (שרת מקומי) ותמונה שנטענת באיחור
const runs = [];
for (const delay of [0, 400]) {
  runs.push([`desktop, ${delay}ms`, { width: 1280, height: 800 }, false, delay]);
  runs.push([`mobile, ${delay}ms`, { width: 360, height: 740 }, true, delay]);
}

for (const [name, viewport, mobile, delay] of runs) {
  const ctx = await browser.newContext({ viewport, isMobile: mobile, hasTouch: mobile, colorScheme: "light" });
  await ctx.addInitScript((t) => localStorage.setItem("token", t), token);

  // Streaming מדומה: fetch ל-/stream מחזיר אירועים בהשהיות, כמו השרת (tool, ‏tokens, ‏done)
  await ctx.addInitScript(() => {
    const realFetch = window.fetch;
    window.fetch = async (input, init) => {
      const url = String(input);
      if (!url.endsWith("/stream") || !window.__mockDone) return realFetch(input, init);
      const done = window.__mockDone;
      const events = [{ type: "tool", name: "generate_image" }];
      for (const word of done.assistant_message.content.split(" ")) events.push({ type: "token", text: word + " " });
      events.push({ type: "done", ...done });
      const encoder = new TextEncoder();
      const body = new ReadableStream({
        async start(controller) {
          for (const event of events) {
            await new Promise((r) => setTimeout(r, event.type === "tool" ? 600 : 60));
            controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
          }
          controller.close();
        },
      });
      return new Response(body, { status: 200, headers: { "Content-Type": "application/x-ndjson" } });
    };
  });
  if (delay) {
    await ctx.route("**/uploads/**", async (route) => {
      await new Promise((r) => setTimeout(r, delay));
      await route.continue();
    });
  }

  // 1. שיחה קיימת וארוכה: הסוכן יוצר תמונה
  let p = await ctx.newPage();
  await p.goto(`${URL}/c/${cid}`);
  await p.locator(".message-list .message-assistant").first().waitFor();
  await p.waitForTimeout(500);
  await p.evaluate((done) => { window.__mockDone = done; }, { user_message: userMsg(900001, cid), assistant_message: imageMsg(900002, cid) });
  await p.getByLabel("Message", { exact: true }).fill("Draw a dog riding a bicycle");
  await p.keyboard.press("Enter");
  await p.locator(".message-list .message-assistant img").last().waitFor();
  await waitForImage(p);
  let r = await lastVisible(p);
  check(`[${name}] existing chat: generated image fully visible above the input`, r.ok, JSON.stringify(r));
  await p.screenshot({ path: SHOTS + `image-scroll-${mobile ? "mobile" : "desktop"}-${delay}-stream.png` });
  await p.close();

  // 2. חזרה לשיחה שההודעה האחרונה בה היא תמונה (התשובה מהשרת מדומה: השיחה הארוכה ועוד תמונה בסוף)
  await ctx.route(`**/api/conversations/${cid}`, async (route) => {
    if (route.request().method() !== "GET") return route.continue();
    const response = await route.fetch();
    const data = await response.json();
    data.messages.push(userMsg(900001, cid), imageMsg(900002, cid));
    await route.fulfill({ response, json: data });
  });
  p = await ctx.newPage();
  await p.goto(`${URL}/c/${cid}`);
  await p.locator(".message-list .message-assistant img").last().waitFor();
  await waitForImage(p);
  r = await lastVisible(p);
  check(`[${name}] reopen chat ending with an image: image fully visible`, r.ok, JSON.stringify(r));
  await p.screenshot({ path: SHOTS + `image-scroll-${mobile ? "mobile" : "desktop"}-${delay}-reopen.png` });

  // משתמש שגלל למעלה בכוונה לא נמשך חזרה לסוף כשהדף גדל (שורת ההקלדה גדלה)
  await p.mouse.move(viewport.width / 2, 200);
  await p.mouse.wheel(0, -600);
  await p.waitForTimeout(400);
  const yBefore = await p.evaluate(() => window.scrollY);
  await p.getByLabel("Message", { exact: true }).fill("line 1\nline 2\nline 3\nline 4\nline 5\nline 6");
  await p.waitForTimeout(400);
  const yAfter = await p.evaluate(() => window.scrollY);
  check(`[${name}] scrolled up: page growth does not pull to the bottom`, yBefore > 0 && Math.abs(yAfter - yBefore) <= 1, `${yBefore} -> ${yAfter}`);
  await p.close();
  await ctx.unroute(`**/api/conversations/${cid}`);

  // 2ב. אותו דבר עם תמונה שהמשתמש צירף (בלי גודל ידוע מראש), ותשובה קצרה אחריה
  await ctx.route(`**/api/conversations/${cid}`, async (route) => {
    if (route.request().method() !== "GET") return route.continue();
    const response = await route.fetch();
    const data = await response.json();
    data.messages.push({ ...userMsg(900001, cid), content: "What is in this image?", image_path: imagePath },
      { ...imageMsg(900002, cid), content: "A light square on a green background.", image_path: null });
    await route.fulfill({ response, json: data });
  });
  p = await ctx.newPage();
  await p.goto(`${URL}/c/${cid}`);
  await p.locator(".message-list .message-user img").last().waitFor();
  await waitForImage(p);
  r = await lastVisible(p);
  check(`[${name}] reopen chat with an attached image: last message fully visible`, r.ok, JSON.stringify(r));
  await p.close();
  await ctx.unroute(`**/api/conversations/${cid}`);

  // 3. שיחה חדשה שהתשובה הראשונה בה היא תמונה (גם כאן השרת מדומה, אז לא נוצרת שיחה אמיתית)
  const fakeId = 999999;
  await ctx.route(`**/api/conversations/${fakeId}`, (route) => route.fulfill({
    json: { id: fakeId, title: "Dog on a bicycle", created_at: now, updated_at: now, messages: [userMsg(900001, fakeId), imageMsg(900002, fakeId)] },
  }));
  p = await ctx.newPage();
  await p.goto(URL + "/");
  await p.evaluate((done) => { window.__mockDone = done; }, {
    conversation: { id: fakeId, title: "Dog on a bicycle", created_at: now, updated_at: now },
    user_message: userMsg(900001, fakeId), assistant_message: imageMsg(900002, fakeId),
  });
  await p.getByLabel("Message", { exact: true }).fill("Draw a dog riding a bicycle");
  await p.keyboard.press("Enter");
  await p.waitForURL(`**/c/${fakeId}`);
  await waitForImage(p);
  r = await lastVisible(p);
  check(`[${name}] new chat: generated image fully visible`, r.ok, JSON.stringify(r));
  await p.screenshot({ path: SHOTS + `image-scroll-${mobile ? "mobile" : "desktop"}-${delay}-new.png` });
  await p.close();
  await ctx.close();
}

console.log(failures === 0 ? "ALL PASSED" : `${failures} FAILED`);
await browser.close();
