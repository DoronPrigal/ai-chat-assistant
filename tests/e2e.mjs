import { chromium } from "playwright-core";

const URL = "http://localhost:5173";
const SHOTS = "./shots/";
const created = new Set();
let failures = 0;

const visible = (loc) => loc.first().waitFor({ timeout: 5000 }).then(() => true, () => false);

function check(name, ok, extra = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  — " + extra : ""}`);
  if (!ok) failures++;
}

const browser = await chromium.launch({ channel: "msedge", headless: true });

// שלב 4: משתמש בדיקה חדש דרך ה-API, והטוקן שלו נכנס לכל הקשר דפדפן
const testUser = `e2e_${Date.now()}`;
const auth = await (await fetch("http://localhost:8000/api/auth/register", {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ username: testUser, password: "e2e-pass-123" }),
})).json();
const loggedIn = (c) => c.addInitScript((t) => { if (!sessionStorage.getItem("seeded")) { localStorage.setItem("token", t); sessionStorage.setItem("seeded", "1"); } }, auth.access_token);

// ---------- מחשב, מצב בהיר ----------
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, colorScheme: "light" });
await loggedIn(ctx);
const page = await ctx.newPage();
const consoleErrors = [];
page.on("console", (m) => m.type() === "error" && consoleErrors.push(m.text()));
page.on("pageerror", (e) => consoleErrors.push(e.message));
page.on("response", async (r) => {
  // שיחה חדשה: המזהה מגיע באירוע done של הזרם
  if (r.url().endsWith("/api/conversations/stream") && r.status() === 200) {
    const text = await r.text().catch(() => "");
    const done = text.split("\n").filter(Boolean).map((line) => JSON.parse(line)).find((e) => e.type === "done");
    if (done) created.add(done.conversation.id);
  }
});

await page.goto(URL);
await page.locator(".empty-state").waitFor(); // מחכים לבדיקת הטוקן מול השרת
check("theme follows system (light)", (await page.getAttribute("html", "data-theme")) === "light");
check("empty state title", await page.getByRole("heading", { name: "What's on the agenda today?" }).isVisible());
check("4 suggestions", (await page.locator(".suggestion").count()) === 4);
check("sidebar hidden by default on desktop", !(await page.locator("#sidebar").isVisible()));
check("New chat visible in header while sidebar is closed", await page.locator("header").getByRole("link", { name: "New chat" }).isVisible());
check("logo link has an accessible name", (await page.getByRole("link", { name: "AI Chat – home" }).count()) === 1);
await page.screenshot({ path: SHOTS + "1-desktop-empty-light.png" });

const input = page.getByLabel("Message", { exact: true });
await input.fill("line one");
await input.press("Shift+Enter");
await input.type("line two");
check("Shift+Enter adds a new line", (await input.inputValue()) === "line one\nline two");
await input.fill("");
check("send disabled when input empty", await page.getByRole("button", { name: "Send message" }).isDisabled());

await input.fill("Tell me a one-liner programming joke");
await input.press("Enter");
check("thinking indicator shown", await page.getByText("Thinking…").isVisible());
check("send disabled while waiting", await page.getByRole("button", { name: "Send message" }).isDisabled());
await page.locator(".message-list .message-assistant").first().waitFor({ timeout: 30000 });
check("URL changed to /c/:id after first message", /\/c\/\d+$/.test(page.url()), page.url());
check("user message on the right", await page.locator(".message-user").count() === 1);

await input.fill("still one-liner, but change the subject");
await input.press("Enter");
await page.locator(".message-list .message-assistant").nth(1).waitFor({ timeout: 30000 });
await input.fill("What was my first request? Answer in one short sentence.");
await input.press("Enter");
await page.locator(".message-list .message-assistant").nth(2).waitFor({ timeout: 30000 });
const contextAnswer = await page.locator(".message-list .message-assistant .message-content").nth(2).innerText();
check("context kept across messages", /joke/i.test(contextAnswer), contextAnswer);
await page.screenshot({ path: SHOTS + "2-desktop-chat-light.png" });

// סרגל צד: פתיחה, שמירה ב-localStorage, ושמירה אחרי רענון
await page.getByRole("button", { name: "Show conversations" }).click();
check("sidebar opens", await page.locator("#sidebar").isVisible());
check("conversation listed with its title", await page.locator(".conversation-link", { hasText: "Tell me a one-liner programming joke" }).first().isVisible());
await page.reload();
check("sidebar choice remembered after refresh", await visible(page.locator("#sidebar")));
await page.locator(".message-list .message-assistant").nth(2).waitFor({ timeout: 10000 });
check("conversation reloaded after refresh (6 messages)", (await page.locator(".message").count()) === 6);
const chatUrl = page.url();

// שיחה חדשה בעברית
await page.locator("#sidebar").getByRole("link", { name: "New chat" }).click();
await page.locator(".empty-state").waitFor({ timeout: 5000 });
check("New chat shows empty state", await page.locator(".empty-state").isVisible() && page.url() === URL + "/");
await input.fill("מה בירת צרפת? תשובה במילה אחת");
await input.press("Enter");
await page.locator(".message-list .message-assistant").first().waitFor({ timeout: 30000 });
const hebrewDir = await page.locator(".message-user .message-content").evaluate((el) => getComputedStyle(el).direction);
const hebrewAnswer = await page.locator(".message-list .message-assistant .message-content").innerText();
check("Hebrew message shown right-to-left", hebrewDir === "rtl", hebrewDir);
check("assistant answers in Hebrew", /[\u0590-\u05FF]/.test(hebrewAnswer), hebrewAnswer);

// חזרה לשיחה קודמת
await page.locator(".conversation-link", { hasText: "Tell me a one-liner programming joke" }).first().click();
await page.locator(".message-list .message-assistant").nth(2).waitFor({ timeout: 10000 });
check("return to previous conversation", page.url() === chatUrl && (await page.locator(".message").count()) === 6);

// העתקה
await ctx.grantPermissions(["clipboard-read", "clipboard-write"]);
await page.locator(".copy-button").first().click();
check("copy shows 'Copied' feedback", await visible(page.locator(".copy-button", { hasText: "Copied" })));

// מצב כהה
await page.getByRole("button", { name: "Switch to dark mode" }).click();
check("dark mode on", (await page.getAttribute("html", "data-theme")) === "dark");
check("theme saved", (await page.evaluate(() => localStorage.getItem("theme"))) === "dark");
check("toggle label updated", await page.getByRole("button", { name: "Switch to light mode" }).isVisible());
await page.screenshot({ path: SHOTS + "3-desktop-chat-dark.png" });

// אודות
await page.getByRole("link", { name: "About" }).click();
check("About page", await visible(page.getByRole("heading", { name: "About this project" })));
check("About nav marked current", (await page.getByRole("link", { name: "About" }).getAttribute("aria-current")) === "page");
await page.screenshot({ path: SHOTS + "4-desktop-about-dark.png", fullPage: true });

// שיחה שלא קיימת
await page.goto(URL + "/c/999999");
check("missing conversation message", await visible(page.getByRole("heading", { name: "Conversation not found" })));

// כשל בשרת: "נסה שוב" עובד ולא נוצרת שיחה ריקה
await page.goto(URL);
await page.route("**/api/conversations/stream", (route) => route.abort());
await input.fill("Say hi in 3 words");
await input.press("Enter");
await page.getByRole("button", { name: "Try again" }).waitFor({ timeout: 10000 });
check("friendly error shown", await page.getByText("Can't reach the server").isVisible());
await page.screenshot({ path: SHOTS + "5-desktop-error-dark.png" });
await page.unroute("**/api/conversations/stream");
await page.getByRole("button", { name: "Try again" }).click();
await page.locator(".message-list .message-assistant").first().waitFor({ timeout: 30000 });
check("retry succeeded", (await page.locator(".message-user").count()) === 1);

// כשל, ואז הודעה חדשה (בלי "נסה שוב"): ההודעה שנכשלה יורדת מהמסך
await page.route("**/api/conversations/*/messages/stream", (route) => route.abort());
await input.fill("This one will fail");
await input.press("Enter");
await page.getByRole("button", { name: "Try again" }).waitFor({ timeout: 10000 });
await page.unroute("**/api/conversations/*/messages/stream");
await input.fill("Say bye in 3 words");
await input.press("Enter");
await page.locator(".message-list .message-assistant").nth(1).waitFor({ timeout: 30000 });
const userTexts = await page.locator(".message-user .message-content").allInnerTexts();
check("failed message removed when sending a new one", !userTexts.includes("This one will fail") && userTexts.length === 2, userTexts.join(" / "));

// מחיקה
page.once("dialog", (d) => d.accept());
const deleteId = [...created].at(-1);
await page.locator(`.conversation-link[href="/c/${deleteId}"] + .delete-button`).click();
await page.waitForURL(URL + "/");
check("delete removes conversation and opens new chat", (await page.locator(`.conversation-link[href="/c/${deleteId}"]`).count()) === 0);
created.delete(deleteId);

// ---------- נייד ----------
for (const width of [360, 414]) {
  const m = await browser.newContext({ viewport: { width, height: 760 }, colorScheme: "dark", hasTouch: true, isMobile: true });
  await loggedIn(m);
  const mp = await m.newPage();
  mp.on("pageerror", (e) => consoleErrors.push(e.message));
  await mp.goto(chatUrl);
  await mp.locator(".message-list .message-assistant").nth(2).waitFor({ timeout: 10000 });
  check(`[${width}px] theme follows system (dark)`, (await mp.getAttribute("html", "data-theme")) === "dark");
  check(`[${width}px] no horizontal scroll (chat)`, await mp.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  check(`[${width}px] sidebar closed`, !(await mp.locator("#sidebar").isVisible()));
  await mp.screenshot({ path: SHOTS + `6-mobile-${width}-chat-dark.png` });
  await mp.getByRole("button", { name: "Show conversations" }).click();
  check(`[${width}px] drawer opens over content`, await mp.locator(".sidebar-backdrop").isVisible());
  await mp.screenshot({ path: SHOTS + `7-mobile-${width}-drawer-dark.png` });
  await mp.keyboard.press("Escape");
  check(`[${width}px] Escape closes drawer`, !(await mp.locator(".sidebar-backdrop").isVisible()));
  check(`[${width}px] focus returns to the toggle button`, (await mp.evaluate(() => document.activeElement?.getAttribute("aria-controls"))) === "sidebar");
  await mp.getByRole("button", { name: "Show conversations" }).click();
  await mp.getByRole("button", { name: "Close conversations" }).click();
  check(`[${width}px] close button closes drawer`, !(await mp.locator(".sidebar-backdrop").isVisible()));
  await mp.getByRole("button", { name: "Show conversations" }).click();
  await mp.locator(".conversation-link").first().click();
  check(`[${width}px] drawer closes after choosing`, !(await mp.locator(".sidebar-backdrop").isVisible()));
  await mp.goto(URL + "/about");
  check(`[${width}px] no horizontal scroll (about)`, await mp.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  await mp.screenshot({ path: SHOTS + `8-mobile-${width}-about-dark.png`, fullPage: true });
  await mp.goto(URL);
  await mp.screenshot({ path: SHOTS + `9-mobile-${width}-empty-dark.png` });
  await m.close();
}

// מקלדת: Tab ראשון מגיע לקישור הדילוג
await page.goto(URL + "/about");
await page.getByRole("heading", { name: "About this project" }).waitFor();
await page.keyboard.press("Tab");
check("first Tab = skip link", (await page.evaluate(() => document.activeElement?.textContent)) === "Skip to content");
await page.screenshot({ path: SHOTS + "10-desktop-about-light-focus.png" });

check("no console errors", consoleErrors.filter((e) => !e.startsWith("Failed to load resource")).length === 0, consoleErrors.join(" | "));
console.log("\nCreated test conversations:", [...created].join(","));
console.log(failures === 0 ? "\nALL PASSED" : `\n${failures} FAILED`);
await browser.close();
