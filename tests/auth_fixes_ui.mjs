import { chromium } from "playwright-core";

const URL = "http://localhost:5173";
let failures = 0;
const check = (name, ok, extra = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  — " + extra : ""}`);
  if (!ok) failures++;
};
const visible = (loc) => loc.first().waitFor({ timeout: 5000 }).then(() => true, () => false);
const browser = await chromium.launch({ channel: "msedge", headless: true });

// משתמש עם שיחה אחת (שיחה דרך ה-API, קריאה אחת ל-OpenAI)
const name = `fix_ui_${Date.now()}`;
const reg = await (await fetch("http://localhost:8000/api/auth/register", {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ username: name, password: "fix-pass-123" }),
})).json();
const conv = await (await fetch("http://localhost:8000/api/conversations", {
  method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${reg.access_token}` },
  body: JSON.stringify({ content: "Say hi in 2 words" }),
})).json();
const chatPath = `/c/${conv.conversation.id}`;

// 1. השרת לא זמין בטעינה: הודעה ברורה, והטוקן לא נמחק
const ctx1 = await browser.newContext();
await ctx1.addInitScript((t) => localStorage.setItem("token", t), reg.access_token);
const p1 = await ctx1.newPage();
await p1.route("**/api/auth/me", (route) => route.abort());
await p1.goto(URL + chatPath);
check("server down on load -> clear message", await visible(p1.getByRole("alert").filter({ hasText: "Can't reach the server" })));
check("server down on load -> token kept", (await p1.evaluate(() => localStorage.getItem("token"))) === reg.access_token);
await p1.unroute("**/api/auth/me");
await p1.getByRole("button", { name: "Try again" }).click();
check("Try again after server is back -> conversation opens", await visible(p1.locator(".message-assistant")));
await ctx1.close();

// 2. הטוקן פג באמצע: אחרי התחברות חוזרים לאותה שיחה
const ctx2 = await browser.newContext();
await ctx2.addInitScript((t) => { if (!sessionStorage.getItem("seeded")) { localStorage.setItem("token", t); sessionStorage.setItem("seeded", "1"); } }, reg.access_token);
const p2 = await ctx2.newPage();
await p2.goto(URL + chatPath);
await p2.locator(".message-assistant").first().waitFor();
await p2.evaluate(() => localStorage.setItem("token", "expired.token.value"));
await p2.getByLabel("Message", { exact: true }).fill("hello"); // הבקשה הבאה תישלח עם הטוקן הפגום
await p2.getByLabel("Message", { exact: true }).press("Enter");
await p2.waitForURL("**/login");
check("expired token mid-session -> login with notice", await visible(p2.getByText("Your session has expired")));
await p2.getByLabel("Username").fill(name);
await p2.getByLabel("Password").fill("wrong-pass-1");
await p2.getByRole("button", { name: "Log in" }).click();
check("wrong password with stale token -> stays on login with error",
  await visible(p2.getByRole("alert").filter({ hasText: "Incorrect username or password" })) && p2.url().endsWith("/login"));
check("error is linked to the fields (aria-describedby)",
  (await p2.getByLabel("Username").getAttribute("aria-describedby"))?.includes("auth-error") &&
  (await p2.getByLabel("Username").getAttribute("aria-invalid")) === "true");
await p2.getByLabel("Password").fill("fix-pass-123");
await p2.getByRole("button", { name: "Log in" }).click();
await p2.waitForURL((u) => !u.pathname.startsWith("/login"));
check("after re-login -> back to the same conversation", new globalThis.URL(p2.url()).pathname === chatPath, p2.url());
await ctx2.close();

// 3. ולידציה: סיסמה מעל 72 בתים בצד הלקוח
const ctx3 = await browser.newContext();
const p3 = await ctx3.newPage();
await p3.goto(URL + "/register");
await p3.getByLabel("Username").fill(`fix_long_${Date.now() % 100000}`);
await p3.getByLabel("Password").fill("סיסמה".repeat(10));
await p3.getByRole("button", { name: "Sign up" }).click();
check("client blocks password over 72 bytes", await visible(p3.getByRole("alert").filter({ hasText: "Password is too long." })));
await ctx3.close();

console.log(failures === 0 ? "ALL PASSED" : `${failures} FAILED`);
await browser.close();
