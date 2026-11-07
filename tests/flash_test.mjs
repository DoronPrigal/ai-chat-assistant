import { chromium } from "playwright-core";
const reg = await (await fetch("http://127.0.0.1:8000/api/auth/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: `flash_${Date.now()}`, password: "flash-pass-1" }) })).json();
const browser = await chromium.launch({ channel: "msedge", headless: true });
const ctx = await browser.newContext();
await ctx.addInitScript((t) => localStorage.setItem("token", t), reg.access_token);
const p = await ctx.newPage();
await p.goto("http://localhost:5173/");
await p.locator(".empty-state").waitFor();
for (const [i, text] of ["Say hello in 5 words", "Now say goodbye in 5 words"].entries()) {
  await p.getByLabel("Message", { exact: true }).fill(text);
  await p.getByLabel("Message", { exact: true }).press("Enter");
  await p.locator(".live-answer .markdown").waitFor({ timeout: 60000 });
  // ברגע שהתשובה נשמרה (ה-live נעלם), בודקים את ההודעות האחרונות
  await p.waitForFunction((n) => !document.querySelector(".live-answer") && document.querySelectorAll(".message-list .message-assistant").length === n, i + 1, { polling: 10 });
  const info = await p.evaluate(() => [...document.querySelectorAll(".message-list .message")].slice(-2).map((el) => {
    const s = getComputedStyle(el);
    return `${el.classList.contains("message-user") ? "user" : "assistant"}: animation=${s.animationName} opacity=${s.opacity}`;
  }));
  const ok = info.every((line) => line.includes("animation=none") && line.includes("opacity=1"));
  console.log(`${ok ? "PASS" : "FAIL"}  ${i === 0 ? "new chat" : "existing chat"}: no re-animation when the answer is saved  — ${info.join(" | ")}`);
}
await browser.close();
