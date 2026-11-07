import { readFileSync } from "node:fs";
import { chromium } from "playwright-core";

const AXE = readFileSync("./node_modules/axe-core/axe.min.js", "utf8");
const URL = "http://localhost:5173";
const api = async (path, body, token) => (await fetch("http://127.0.0.1:8000/api" + path, {
  method: "POST", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  body: JSON.stringify(body),
})).json();

// משתמש עם שיחה שיש בה Markdown (קריאה אחת ל-OpenAI)
const reg = await api("/auth/register", { username: `axe_${Date.now()}`, password: "axe-pass-123" });
const conv = await api("/conversations", { content: "Give me 3 short tips for learning React as a list, then one line of example code." }, reg.access_token);
const chatPath = `/c/${conv.conversation.id}`;

const browser = await chromium.launch({ channel: "msedge", headless: true });
let total = 0;

async function audit(name, page) {
  await page.waitForTimeout(600); // אחרי אנימציות ה-fade, כדי למדוד את הצבעים הסופיים
  await page.addScriptTag({ content: AXE });
  const result = await page.evaluate(async () =>
    // eslint-disable-next-line no-undef
    await axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"] } }),
  );
  total += result.violations.length;
  const status = result.violations.length === 0 ? "PASS" : "FAIL";
  console.log(`${status}  ${name}  (${result.passes.length} rules passed, ${result.violations.length} violations)`);
  for (const v of result.violations) {
    console.log(`      - [${v.impact}] ${v.id}: ${v.help}`);
    for (const n of v.nodes.slice(0, 3)) console.log(`          ${n.target.join(" ")} :: ${n.failureSummary.split("\n").slice(1, 2).join(" ").trim()}`);
  }
}

for (const scheme of ["light", "dark"]) {
  // לא מחובר
  const out = await (await browser.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: scheme })).newPage();
  await out.goto(URL + "/login");
  await out.getByRole("heading", { name: "Welcome back" }).waitFor();
  await audit(`[${scheme}] login`, out);
  await out.getByLabel("Username").fill("x");
  await out.getByRole("button", { name: "Log in" }).click();
  await out.getByRole("alert").waitFor();
  await audit(`[${scheme}] login with error`, out);
  await out.goto(URL + "/register");
  await out.getByRole("heading", { name: "Create your account" }).waitFor();
  await audit(`[${scheme}] register`, out);
  await out.goto(URL + "/about");
  await out.getByRole("heading", { name: "About this project" }).waitFor();
  await audit(`[${scheme}] about`, out);

  // מחובר, מחשב
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: scheme });
  await ctx.addInitScript((t) => localStorage.setItem("token", t), reg.access_token);
  const p = await ctx.newPage();
  await p.goto(URL);
  await p.locator(".empty-state").waitFor();
  await audit(`[${scheme}] new chat (empty state)`, p);
  await p.goto(URL + chatPath);
  await p.locator(".message-assistant .markdown").waitFor();
  await p.getByRole("button", { name: "Show conversations" }).click();
  await p.waitForTimeout(300);
  await audit(`[${scheme}] conversation with Markdown + sidebar open`, p);
  await p.getByRole("button", { name: /Account menu/ }).click();
  await p.locator(".user-menu-panel").waitFor();
  await audit(`[${scheme}] user menu open`, p);

  // נייד: מגירה פתוחה
  const m = await browser.newContext({ viewport: { width: 360, height: 760 }, colorScheme: scheme, isMobile: true, hasTouch: true });
  await m.addInitScript((t) => localStorage.setItem("token", t), reg.access_token);
  const mp = await m.newPage();
  await mp.goto(URL + chatPath);
  await mp.locator(".message-assistant .markdown").waitFor();
  await audit(`[${scheme}] mobile conversation`, mp);
  await mp.getByRole("button", { name: "Show conversations" }).tap();
  await mp.waitForTimeout(400);
  await audit(`[${scheme}] mobile drawer open`, mp);
}
console.log(total === 0 ? "\nNO VIOLATIONS" : `\n${total} violations in total`);
await browser.close();
