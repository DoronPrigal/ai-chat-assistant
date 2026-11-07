import { chromium } from "playwright-core";

const URL = "http://localhost:5173";
const SHOTS = "./shots/";
let failures = 0;
const check = (name, ok, extra = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  — " + extra : ""}`);
  if (!ok) failures++;
};
const visible = (loc, timeout = 5000) => loc.first().waitFor({ timeout }).then(() => true, () => false);
const reg = await (await fetch("http://127.0.0.1:8000/api/auth/register", {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ username: `bonus_${Date.now()}`, password: "bonus-pass-1" }),
})).json();

// SpeechRecognition מדומה: "שומע" שתי מילים בהדרגה ואז מסיים
const FAKE_SPEECH = () => {
  window.__speech = { lang: null, started: 0 };
  class FakeRecognition {
    start() {
      window.__speech.lang = this.lang;
      window.__speech.started++;
      const mode = window.__speechMode || "ok";
      if (mode === "error") return setTimeout(() => { this.onerror?.({ error: "not-allowed" }); this.onend?.(); }, 100);
      setTimeout(() => this.onresult?.({ results: { length: 1, 0: { 0: { transcript: "hello" } } } }), 150);
      setTimeout(() => this.onresult?.({ results: { length: 2, 0: { 0: { transcript: "hello" } }, 1: { 0: { transcript: " world" } } } }), 300);
      if (mode !== "long") setTimeout(() => this.onend?.(), 450);
    }
    stop() { setTimeout(() => this.onend?.(), 50); }
    abort() { window.__speech.aborted = true; }
  }
  window.SpeechRecognition = FakeRecognition;
  window.webkitSpeechRecognition = FakeRecognition;
};

const browser = await chromium.launch({ channel: "msedge", headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: "light" });
await ctx.addInitScript((t) => localStorage.setItem("token", t), reg.access_token);
await ctx.addInitScript(FAKE_SPEECH);
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(URL);
await page.locator(".empty-state").waitFor();
const input = page.getByLabel("Message", { exact: true });

// ===== 1. Streaming אמיתי מול השרת =====
await input.fill("What's the weather in Haifa right now? Answer in 4 short sentences.");
await input.press("Enter");
check("tool indicator: 'Checking the weather…'", await visible(page.getByRole("status").filter({ hasText: "Checking the weather…" }), 30000));
const live = page.locator(".live-answer .markdown");
await live.waitFor({ timeout: 60000 });
check("live answer is aria-hidden (no word-by-word announcements)", (await page.locator(".live-answer article").getAttribute("aria-hidden")) === "true");
check("status says 'Writing the answer…' for screen readers", (await page.getByRole("status").filter({ hasText: "Writing the answer…" }).count()) === 1);
const lengths = [];
while (await live.count()) {
  lengths.push((await live.innerText().catch(() => "")).length);
  await page.waitForTimeout(40);
}
await page.waitForURL(/\/c\/\d+$/);
const saved = page.locator(".message-list .message-assistant .markdown");
await saved.waitFor();
check("after the answer: saved message in the log, URL /c/:id", (await saved.count()) === 1 && (await page.locator(".live-answer").count()) === 0);
const finalText = await saved.innerText();
await page.reload();
await page.locator(".message-list .message-assistant .markdown").waitFor();
check("answer was saved (still there after refresh)", (await page.locator(".message-list .message-assistant .markdown").innerText()) === finalText);

// המשך באותו הקשר (Streaming)
await input.fill("Which city did I ask about? One word.");
await input.press("Enter");
let logHadPartial = false;
while (await page.locator(".live-answer").count() || (await page.locator(".message-list .message-assistant").count()) < 2) {
  if ((await page.locator(".live-answer .markdown").count()) && (await page.locator(".message-list .message-assistant").count()) > 1) logHadPartial = true;
  await page.waitForTimeout(30);
}
check("log gets the answer only when it is complete", !logHadPartial);
check("context kept (streaming)", /haifa/i.test(await page.locator(".message-list .message-assistant .markdown").nth(1).innerText()));
await page.screenshot({ path: SHOTS + "bonus-stream-done.png" });
const haifaUrl = page.url();

// מדידה מדויקת של הגדילה: MutationObserver בתוך הדף רושם כל שינוי בטקסט שנכתב
await page.goto(URL);
await page.locator(".empty-state").waitFor();
await page.evaluate(() => {
  window.__lengths = [];
  new MutationObserver(() => {
    const live = document.querySelector(".live-answer .markdown");
    if (live) window.__lengths.push(live.innerText.length);
  }).observe(document.body, { subtree: true, childList: true, characterData: true });
});
await input.fill("Write a 120-word story about a lighthouse keeper.");
await input.press("Enter");
await page.waitForURL(/\/c\/\d+$/, { timeout: 90000 });
const updates = await page.evaluate(() => [...new Set(window.__lengths)].filter((n) => n > 0));
check(`text grows word by word (${updates.length} updates, ${updates[0]} -> ${updates.at(-1)} chars)`, updates.length >= 20);
await page.goto(haifaUrl); // חזרה לשיחה על חיפה (2 הודעות) להמשך הבדיקה
await page.locator(".message-list .message-assistant").nth(1).waitFor();
// ===== 2. כשל באמצע הזרם (תשובה מדומה) ו-Try again =====
await page.route("**/messages/stream", (route) => route.fulfill({
  status: 200, contentType: "application/x-ndjson",
  body: '{"type":"token","text":"Half an "}\n{"type":"token","text":"answer"}\n{"type":"error","message":"The AI service is not available right now. Please try again."}\n',
}));
await input.fill("Say something nice");
await input.press("Enter");
check("error event -> friendly error + Try again", await visible(page.getByRole("alert").filter({ hasText: "AI service is not available" })));
check("partial answer is removed after the error", (await page.locator(".live-answer").count()) === 0);
await page.unroute("**/messages/stream");
await page.getByRole("button", { name: "Try again" }).click();
await page.locator(".message-list .message-assistant").nth(2).waitFor({ timeout: 60000 });
check("Try again works with streaming", (await page.locator(".message-list .message-user").count()) === 3);

// ===== 3. הקלטה קולית (מדומה) =====
const mic = page.getByRole("button", { name: "Voice input", exact: true });
check("mic button shown (supported browser)", await mic.isVisible());
const langBtn = page.getByRole("button", { name: /Voice input language/ });
const before = await langBtn.innerText();
await langBtn.click();
check("language toggle switches HE/EN", (await langBtn.innerText()) !== before, `${before} -> ${await langBtn.innerText()}`);
if ((await langBtn.innerText()) !== "HE") await langBtn.click();
await input.fill("Note:");
await mic.click();
check("listening: aria-pressed=true + 'Listening…' status", (await mic.getAttribute("aria-pressed")) === "true" &&
  (await page.getByRole("status").filter({ hasText: "Listening…" }).count()) === 1);
await page.waitForTimeout(700);
check("speech text added to the input (after existing text)", (await input.inputValue()) === "Note: hello world", await input.inputValue());
check("recognition used the chosen language (he-IL)", (await page.evaluate(() => window.__speech.lang)) === "he-IL");
check("not sent automatically (still 3 user messages)", (await page.locator(".message-list .message-user").count()) === 3);
check("mic back to off after speech ends", (await mic.getAttribute("aria-pressed")) === "false");
await page.evaluate(() => { window.__speechMode = "error"; });
await mic.click();
check("blocked microphone -> friendly message", await visible(page.getByRole("alert").filter({ hasText: "Microphone access is blocked" })));
await page.evaluate(() => { window.__speechMode = "long"; });
await input.fill("");
await mic.click();
await page.waitForTimeout(400);
await input.fill("send me");
await input.press("Enter");
check("sending stops the recording", await page.evaluate(() => window.__speech.aborted === true));
await page.locator(".message-list .message-assistant").nth(3).waitFor({ timeout: 60000 });
check("text spoken after sending does not come back", (await input.inputValue()) === "");

// דפדפן בלי תמיכה: אין כפתור
const noSpeech = await browser.newContext();
await noSpeech.addInitScript((t) => {
  localStorage.setItem("token", t);
  delete window.SpeechRecognition;
  delete window.webkitSpeechRecognition;
}, reg.access_token);
const ns = await noSpeech.newPage();
await ns.goto(URL);
await ns.locator(".empty-state").waitFor();
check("unsupported browser: no mic button", (await ns.getByRole("button", { name: "Voice input", exact: true }).count()) === 0);
await noSpeech.close();

// ===== 4. Error Boundary =====
const crashCtx = await browser.newContext({ colorScheme: "light" });
await crashCtx.addInitScript((t) => localStorage.setItem("token", t), reg.access_token);
const cp = await crashCtx.newPage();
await cp.route("**/api/conversations", (route) => route.request().method() === "GET"
  ? route.fulfill({ status: 200, contentType: "application/json", body: '{"broken": true}' }) : route.continue());
await cp.goto(URL);
check("component crash -> friendly screen instead of blank", await visible(cp.getByRole("heading", { name: "Something went wrong" })));
await cp.screenshot({ path: SHOTS + "bonus-error-boundary.png" });
await cp.unroute("**/api/conversations");
await cp.getByRole("button", { name: "Reload" }).click();
check("Reload brings the app back", await visible(cp.locator(".empty-state"), 10000));
await crashCtx.close();

// ===== נייד =====
const m = await browser.newContext({ viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true, colorScheme: "dark" });
await m.addInitScript((t) => localStorage.setItem("token", t), reg.access_token);
await m.addInitScript(FAKE_SPEECH);
const mp = await m.newPage();
await mp.goto(URL);
await mp.locator(".empty-state").waitFor();
check("[360px] input row with mic fits (no horizontal scroll)", await mp.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
const ta = await mp.getByLabel("Message", { exact: true }).boundingBox();
check(`[360px] text box still usable (${Math.round(ta.width)}px wide)`, ta.width >= 100);
await mp.screenshot({ path: SHOTS + "bonus-mobile-input.png" });
await mp.getByLabel("Message", { exact: true }).fill("Tell me a one-liner joke about the sea");
await mp.getByLabel("Message", { exact: true }).press("Enter");
await mp.locator(".live-answer .markdown").waitFor({ timeout: 60000 }).catch(() => {});
await mp.screenshot({ path: SHOTS + "bonus-mobile-streaming.png" });
await mp.waitForURL(/\/c\/\d+$/, { timeout: 60000 });
check("[360px] streaming works on mobile", await visible(mp.locator(".message-list .message-assistant .markdown")));
await m.close();

check("no page errors (except the intended crash)", errors.length === 0, errors.join(" | "));
console.log(failures === 0 ? "ALL PASSED" : `${failures} FAILED`);
await browser.close();
