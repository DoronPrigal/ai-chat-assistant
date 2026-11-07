import { chromium } from "playwright-core";

const URL = "http://localhost:5173";
const SHOTS = "./shots/";
let failures = 0;
const check = (name, ok, extra = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  — " + extra : ""}`);
  if (!ok) failures++;
};
const visible = (loc, timeout = 5000) => loc.first().waitFor({ timeout }).then(() => true, () => false);
const activeLabel = (p) => p.evaluate(() => document.activeElement?.getAttribute("aria-label") || document.activeElement?.textContent?.trim());

const username = `polish_${Date.now()}`;
const reg = await (await fetch("http://127.0.0.1:8000/api/auth/register", {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ username, password: "polish-pass-1" }),
})).json();

const browser = await chromium.launch({ channel: "msedge", headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: "light" });
await ctx.grantPermissions(["clipboard-read", "clipboard-write"]);
await ctx.addInitScript((t) => localStorage.setItem("token", t), reg.access_token);
const page = await ctx.newPage();
const errors = [];
let dialogShown = false;
page.on("pageerror", (e) => errors.push(e.message));
page.on("dialog", (d) => { dialogShown = true; d.dismiss(); });
await page.goto(URL);
await page.locator(".empty-state").waitFor();
check("title of new chat page", (await page.title()) === "New chat · AI Chat", await page.title());
const input = page.getByLabel("Message", { exact: true });

// ===== Markdown =====
const md = [
  "Reply ONLY with the following text, exactly as written, with no other words:",
  "", "**Bold words**", "", "- first item", "- second item", "", "שלום עולם, זו פסקה בעברית.", "",
  "```python", "print('hello')", "```", "", "| City | Temp |", "|---|---|", "| Modiin | 18 |", "",
  "<b>raw html</b> <img src=x onerror=alert(1)>",
].join("\n");
await input.fill(md);
await input.press("Enter");
const answer = page.locator(".message-list .message-assistant .markdown").first();
await answer.waitFor({ timeout: 60000 });
check("markdown: bold", (await answer.locator("strong").count()) >= 1);
check("markdown: list", (await answer.locator("ul li").count()) === 2);
check("markdown: code block", await answer.locator("pre code").count() === 1 && (await answer.locator("pre").getAttribute("dir")) === "ltr");
check("markdown: table", (await answer.locator("table td").count()) === 2);
const hebrewP = answer.locator("p", { hasText: "שלום עולם" });
check("markdown: Hebrew paragraph is right-to-left", (await hebrewP.evaluate((el) => getComputedStyle(el).direction)) === "rtl");
check("markdown: raw HTML is NOT rendered (no <b>, no <img src=x>)",
  (await answer.locator("b").count()) === 0 && (await answer.locator('img[src="x"]').count()) === 0 && !dialogShown);
await answer.getByRole("button", { name: "Copy code" }).click();
check("copy code button copies the code", (await page.evaluate(() => navigator.clipboard.readText())).trim() === "print('hello')");
await page.waitForTimeout(300);
await page.screenshot({ path: SHOTS + "polish-markdown-light.png" });
check("conversation title in the browser tab", (await page.title()).includes("Reply ONLY with"), await page.title());

// ===== תפריט משתמש =====
const avatar = page.getByRole("button", { name: `Account menu (${username})` });
check("avatar shows the first letter", (await avatar.innerText()) === username[0].toUpperCase());
check("old logout button removed from header", (await page.locator("header").getByRole("button", { name: /^Log out/ }).count()) === 0);
await page.getByRole("button", { name: "Show conversations" }).click();
check("username removed from sidebar bottom", (await page.locator("#sidebar").getByText("Signed in as").count()) === 0);
await avatar.click();
check("menu opens with 'Signed in as <user>'", await visible(page.getByText(`Signed in as ${username}`)));
check("aria-expanded=true when open", (await avatar.getAttribute("aria-expanded")) === "true");
check("focus moves to 'Log out'", (await activeLabel(page)) === "Log out");
await page.screenshot({ path: SHOTS + "polish-usermenu-light.png" });
await page.keyboard.press("Escape");
check("Escape closes the menu", (await page.getByText(`Signed in as ${username}`).count()) === 0);
check("focus returns to the avatar", (await activeLabel(page)) === `Account menu (${username})`);
await avatar.click();
await page.mouse.click(1270, 450); // שוליים ריקים בצד ימין
check("click outside closes the menu", (await page.getByText(`Signed in as ${username}`).count()) === 0);
await avatar.focus();
await page.keyboard.press("Enter");
check("keyboard Enter opens the menu", await visible(page.getByText(`Signed in as ${username}`)));
await page.keyboard.press("Tab");
await page.waitForTimeout(100);
check("Tab out of the menu closes it", (await page.getByText(`Signed in as ${username}`).count()) === 0);

// ===== מזג אוויר =====
await page.goto(URL);
await page.locator(".empty-state").waitFor();
await input.fill("מה מזג האוויר במודיעין היום?");
await input.press("Enter");
const weather = page.locator(".message-list .message-assistant .markdown").first();
await weather.waitFor({ timeout: 60000 });
const weatherText = await weather.innerText();
check("weather answer in Hebrew with a temperature", /[\u0590-\u05FF]/.test(weatherText) && /\d+\s*(°|מעלות)/.test(weatherText), weatherText);

// ===== אודות =====
await page.getByRole("link", { name: "About" }).click();
await page.getByRole("heading", { name: "About this project" }).waitFor();
check("About page title", (await page.title()) === "About · AI Chat");

// ===== התנתקות דרך התפריט =====
await avatar.click();
await page.getByRole("button", { name: "Log out" }).click();
await page.waitForURL("**/login");
check("Log out from the menu works", (await page.evaluate(() => localStorage.getItem("token"))) === null);
await page.getByRole("heading", { name: "Welcome back" }).waitFor();
check("login page title", (await page.title()) === "Log in · AI Chat");

// ===== נייד =====
const m = await browser.newContext({ viewport: { width: 360, height: 760 }, colorScheme: "dark", isMobile: true, hasTouch: true });
const login = await (await fetch("http://127.0.0.1:8000/api/auth/login", {
  method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username, password: "polish-pass-1" }),
})).json();
await m.addInitScript((t) => localStorage.setItem("token", t), login.access_token);
const mp = await m.newPage();
await mp.goto(URL);
await mp.locator(".empty-state").waitFor();
await mp.getByRole("button", { name: /Account menu/ }).tap();
const panel = mp.locator(".user-menu-panel");
await panel.waitFor();
const box = await panel.boundingBox();
check("[360px] menu panel fits on screen", box.x >= 0 && box.x + box.width <= 360, JSON.stringify(box));
check("[360px] no horizontal scroll with menu open", await mp.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
await mp.screenshot({ path: SHOTS + "polish-usermenu-mobile-dark.png" });
await mp.locator(".empty-subtitle").click(); // אזור ריק (לא כפתור הצעה!)
check("[360px] tap outside closes the menu", (await mp.locator(".user-menu-panel").count()) === 0);
await m.close();

check("no page errors", errors.length === 0, errors.join(" | "));
console.log(failures === 0 ? "ALL PASSED" : `${failures} FAILED`);
await browser.close();
