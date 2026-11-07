import { chromium } from "playwright-core";

const URL = "http://localhost:5173";
const SHOTS = "./shots/";
const api = async (path, body, token) => (await fetch("http://127.0.0.1:8000/api" + path, {
  method: "POST", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  body: JSON.stringify(body),
})).json();
const reg = await api("/auth/register", { username: `resp_${Date.now()}`, password: "resp-pass-123" });
const conv = await api("/conversations", {
  content: "Reply with a markdown table of 6 columns about 3 programming languages, then a 120-character line of Python code in a code block.",
}, reg.access_token);

const browser = await chromium.launch({ channel: "msedge", headless: true });
let failures = 0;
for (const width of [360, 414, 768, 1024, 1440]) {
  const ctx = await browser.newContext({ viewport: { width, height: 850 }, isMobile: width < 900, hasTouch: width < 900 });
  await ctx.addInitScript((t) => localStorage.setItem("token", t), reg.access_token);
  const p = await ctx.newPage();
  const results = [];
  for (const [name, path, ready] of [
    ["chat", `/c/${conv.conversation.id}`, ".message-assistant .markdown"],
    ["new", "/", ".empty-state"],
    ["about", "/about", ".bento"],
  ]) {
    await p.goto(URL + path);
    await p.locator(ready).first().waitFor();
    await p.waitForTimeout(400);
    const ok = await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
    if (!ok) failures++;
    results.push(`${name}:${ok ? "ok" : "HORIZONTAL SCROLL"}`);
    if (name === "chat" && (width === 360 || width === 768)) await p.screenshot({ path: SHOTS + `resp-${width}-chat.png` });
  }
  console.log(`${width}px  ${results.join("  ")}`);
  await ctx.close();
}
console.log(failures === 0 ? "ALL PASSED" : `${failures} FAILED`);
await browser.close();
