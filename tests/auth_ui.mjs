import { chromium } from "playwright-core";

const URL = "http://localhost:5173";
const SHOTS = "./shots/";
let failures = 0;
const check = (name, ok, extra = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  — " + extra : ""}`);
  if (!ok) failures++;
};
const visible = (loc) => loc.first().waitFor({ timeout: 5000 }).then(() => true, () => false);
const stamp = Date.now();
const userA = `ui_a_${stamp}`;
const userB = `ui_b_${stamp}`;

const browser = await chromium.launch({ channel: "msedge", headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, colorScheme: "light" });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));

// מחובר? לא: מועברים להתחברות, בלי כפתורי צ'אט
await page.goto(URL + "/");
await page.waitForURL("**/login");
check("logged out: / redirects to /login", page.url().endsWith("/login"));
check("logged out: no sidebar toggle / New chat / account menu in header",
  (await page.getByRole("button", { name: "Show conversations" }).count()) === 0 &&
  (await page.locator("header").getByRole("link", { name: "New chat" }).count()) === 0 &&
  (await page.getByRole("button", { name: /Account menu/ }).count()) === 0);
await page.screenshot({ path: SHOTS + "auth-login-light.png" });
await page.getByRole("link", { name: "About" }).click();
check("logged out: About page is public", await visible(page.getByRole("heading", { name: "About this project" })));

// הרשמה: ולידציה בדפדפן
await page.goto(URL + "/register");
await page.getByLabel("Username").fill("ab");
await page.getByLabel("Password").fill("123456");
await page.getByRole("button", { name: "Sign up" }).click();
check("register: short username message", await visible(page.getByRole("alert").filter({ hasText: "3–30 characters" })));
await page.getByLabel("Username").fill(userA);
await page.getByLabel("Password").fill("123");
await page.getByRole("button", { name: "Sign up" }).click();
check("register: short password message", await visible(page.getByRole("alert").filter({ hasText: "at least 6" })));
await page.screenshot({ path: SHOTS + "auth-register-error-light.png" });

// הרשמה מוצלחת: נכנסים ישר לצ'אט
await page.getByLabel("Password").fill("pass-a-123");
await page.getByRole("button", { name: "Sign up" }).click();
await page.waitForURL(URL + "/");
check("register: lands on chat, logged in", await visible(page.getByRole("heading", { name: "What's on the agenda today?" })));
check("token saved", (await page.evaluate(() => localStorage.getItem("token")))?.split(".").length === 3);
await page.getByLabel("Message", { exact: true }).fill("Remember the word MANGO. Reply OK.");
await page.getByLabel("Message", { exact: true }).press("Enter");
await page.locator(".message-list .message-assistant").first().waitFor({ timeout: 30000 });
const chatUrl = page.url();
await page.getByRole("button", { name: "Show conversations" }).click();
check("account menu shows the user", (await page.getByRole("button", { name: `Account menu (${userA})` }).count()) === 1);
check("user A sees their conversation", (await page.locator(".conversation-link").count()) === 1);
await page.screenshot({ path: SHOTS + "auth-chat-userA-light.png" });

// הרשמה עם שם תפוס: הודעה מהשרת (409)
const ctx2 = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const p2 = await ctx2.newPage();
await p2.goto(URL + "/register");
await p2.getByLabel("Username").fill(userA);
await p2.getByLabel("Password").fill("whatever-123");
await p2.getByRole("button", { name: "Sign up" }).click();
check("register: taken username shows server message", await visible(p2.getByRole("alert").filter({ hasText: "already taken" })));
await ctx2.close();

// רענון: נשארים מחוברים
await page.reload();
await page.locator(".message-list .message-assistant").first().waitFor({ timeout: 10000 });
check("refresh keeps the user logged in", page.url() === chatUrl);

// התנתקות
await page.getByRole("button", { name: `Account menu (${userA})` }).click(); await page.getByRole("button", { name: "Log out" }).click();
await page.waitForURL("**/login");
check("logout -> /login and token removed", (await page.evaluate(() => localStorage.getItem("token"))) === null);
await page.goto(chatUrl);
await page.waitForURL("**/login");
check("after logout, conversation URL redirects to /login", page.url().endsWith("/login"));

// התחברות: סיסמה שגויה, ואז נכונה -> חוזרים לשיחה שרצינו
await page.getByLabel("Username").fill(userA);
await page.getByLabel("Password").fill("wrong-password");
await page.getByRole("button", { name: "Log in" }).click();
check("login: wrong password message", await visible(page.getByRole("alert").filter({ hasText: "Incorrect username or password" })));
await page.getByLabel("Password").fill("pass-a-123");
await page.getByRole("button", { name: "Log in" }).click();
await page.waitForURL(chatUrl);
check("login returns to the page the user wanted", page.url() === chatUrl);
await page.locator(".message-list .message-assistant").first().waitFor({ timeout: 10000 }); // השיחה נטענה
await page.getByLabel("Message", { exact: true }).fill("What word did I ask you to remember?");
await page.getByLabel("Message", { exact: true }).press("Enter");
await page.locator(".message-list .message-assistant").nth(1).waitFor({ timeout: 30000 });
check("context still works after login", /mango/i.test(await page.locator(".message-list .message-assistant .message-content").nth(1).innerText()));

// משתמש B לא רואה את השיחות של A
await page.getByRole("button", { name: `Account menu (${userA})` }).click(); await page.getByRole("button", { name: "Log out" }).click();
await page.getByRole("link", { name: "Sign up" }).click();
await page.getByRole("heading", { name: "Create your account" }).waitFor();
await page.getByLabel("Username").fill(userB);
await page.getByLabel("Password").fill("pass-b-123");
await page.getByRole("button", { name: "Sign up" }).click();
await page.waitForURL(URL + "/", { timeout: 8000 }).catch(async () => {
  console.log("DEBUG url:", page.url(), "| alert:", await page.getByRole("alert").allInnerTexts().catch(() => []));
  await page.screenshot({ path: SHOTS + "debug-userB.png" });
});
check("user B: empty conversation list", await visible(page.getByText("No conversations yet.")));
await page.goto(chatUrl);
check("user B opening A's conversation URL -> not found", await visible(page.getByRole("heading", { name: "Conversation not found" })));

// טוקן לא תקף בדפדפן -> הודעת "פג תוקף" במסך ההתחברות
await page.evaluate(() => localStorage.setItem("token", "invalid.token.value"));
await page.goto(URL + "/");
await page.waitForURL("**/login");
check("invalid saved token -> login with 'session expired' notice", await visible(page.getByText("Your session has expired")));

// נייד 360px: הכותרת נכנסת בלי גלילה אופקית
const m = await browser.newContext({ viewport: { width: 360, height: 760 }, colorScheme: "light", isMobile: true, hasTouch: true });
const mp = await m.newPage();
await mp.goto(URL + "/login");
await mp.getByLabel("Username").fill(userA);
await mp.getByLabel("Password").fill("pass-a-123");
await mp.getByRole("button", { name: "Log in" }).click();
await mp.waitForURL(URL + "/");
check("[360px] no horizontal scroll when logged in", await mp.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
check("[360px] account menu visible", await mp.getByRole("button", { name: /Account menu/ }).isVisible());
await mp.screenshot({ path: SHOTS + "auth-mobile-360-chat.png" });
await mp.getByRole("button", { name: /Account menu/ }).click(); await mp.getByRole("button", { name: "Log out" }).click();
await mp.waitForURL("**/login");
await mp.screenshot({ path: SHOTS + "auth-mobile-360-login.png" });
await m.close();

const dark = await browser.newContext({ viewport: { width: 1280, height: 800 }, colorScheme: "dark" });
const dp = await dark.newPage();
await dp.goto(URL + "/register");
await dp.waitForTimeout(300);
await dp.screenshot({ path: SHOTS + "auth-register-dark.png" });
await dark.close();

check("no page errors", errors.length === 0, errors.join(" | "));
console.log(`\nusers: ${userA}, ${userB}`);
console.log(failures === 0 ? "ALL PASSED" : `${failures} FAILED`);
await browser.close();
