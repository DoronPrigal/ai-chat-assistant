import { chromium } from "playwright-core";

const URL = "http://localhost:5173";
const SCRATCH = "./";
const SHOTS = SCRATCH + "shots/";
let failures = 0;
const check = (name, ok, extra = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  — " + extra : ""}`);
  if (!ok) failures++;
};
const visible = (loc, timeout = 5000) => loc.first().waitFor({ timeout }).then(() => true, () => false);
const imageLoaded = (loc) => loc.evaluate((img) => img.complete && img.naturalWidth > 0);

const reg = await (await fetch("http://127.0.0.1:8000/api/auth/register", {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ username: `img_ui_${Date.now()}`, password: "img-pass-123" }),
})).json();

const browser = await chromium.launch({ channel: "msedge", headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: "light" });
await ctx.addInitScript((t) => localStorage.setItem("token", t), reg.access_token);
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(URL);
await page.locator(".empty-state").waitFor();
const fileInput = page.locator('input[type="file"]');
const input = page.getByLabel("Message", { exact: true });

// קובץ לא תקין
await fileInput.setInputFiles({ name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("hello") });
check("non-image file -> friendly error", await visible(page.getByRole("alert").filter({ hasText: "Only PNG, JPEG, WebP or GIF" })));

// צירוף, תצוגה מקדימה והסרה
await fileInput.setInputFiles("./fixtures/sample.png");
check("preview shown after attaching", await visible(page.getByAltText("Attached image preview")));
check("send enabled with image only", await page.getByRole("button", { name: "Send message" }).isEnabled());
await page.getByRole("button", { name: "Remove attached image" }).click();
check("remove clears the preview", (await page.getByAltText("Attached image preview").count()) === 0);

// שליחת תמונה עם שאלה (Vision)
await fileInput.setInputFiles("./fixtures/sample.png");
await input.fill("What is the biggest heading in this image? Reply with the heading only.");
await page.screenshot({ path: SHOTS + "img-1-attached.png" });
await input.press("Enter");
check("user image shown immediately", await visible(page.locator(".message-user .message-image")));
await page.locator(".message-list .message-assistant").first().waitFor({ timeout: 60000 });
const visionAnswer = await page.locator(".message-list .message-assistant .message-content").first().innerText();
check("assistant reads the image", /about this project/i.test(visionAnswer), visionAnswer);
const chatUrl = page.url();

// אחרי רענון התמונה נטענת מהשרת
await page.reload();
const userImg = page.locator(".message-user .message-image").first();
await userImg.waitFor({ timeout: 10000 });
check("after refresh the image loads from the server", (await userImg.getAttribute("src")).startsWith("http://localhost:8000/uploads/") && await imageLoaded(userImg));
check("image has alt text", (await userImg.getAttribute("alt")).includes("Image you attached"));
check("image uses loading=lazy", (await userImg.getAttribute("loading")) === "lazy");

// יצירת תמונה דרך הסוכן (התמונה השנייה בתקציב הבדיקות)
await page.goto(URL);
await page.locator(".empty-state").waitFor();
const started = Date.now();
await page.getByRole("button", { name: "Draw a cozy seaside café at sunset" }).click();
check("thinking indicator while generating", await visible(page.getByText("Thinking…")));
const generated = page.locator(".message-list .message-assistant .message-image-generated");
await generated.waitFor({ timeout: 120000 });
console.log(`      image generated in ${((Date.now() - started) / 1000).toFixed(1)}s`);
await page.waitForFunction(() => {
  const img = document.querySelector(".message-image-generated");
  return img && img.complete && img.naturalWidth > 0;
});
check("generated image loaded (1024px)", (await generated.evaluate((img) => img.naturalWidth)) === 1024);
const genText = (await page.locator(".message-list .message-assistant .message-content").allInnerTexts()).join(" ");
check("answer text has no file path or markdown image", !genText.includes("/uploads") && !genText.includes("!["), genText);
await page.waitForTimeout(400);
await page.screenshot({ path: SHOTS + "img-2-generated-light.png" });

// נייד: תמונות לא גורמות לגלילה אופקית
const m = await browser.newContext({ viewport: { width: 360, height: 760 }, colorScheme: "dark", isMobile: true, hasTouch: true });
await m.addInitScript((t) => localStorage.setItem("token", t), reg.access_token);
const mp = await m.newPage();
await mp.goto(page.url());
await mp.locator(".message-image-generated").waitFor();
await mp.waitForTimeout(500);
check("[360px] no horizontal scroll with images", await mp.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
await mp.screenshot({ path: SHOTS + "img-3-mobile-dark.png" });
await mp.goto(chatUrl);
await mp.locator(".message-user .message-image").waitFor();
await mp.waitForTimeout(500);
check("[360px] no horizontal scroll (vision chat)", await mp.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
await m.close();

check("no page errors", errors.length === 0, errors.join(" | "));
console.log(failures === 0 ? "ALL PASSED" : `${failures} FAILED`);
await browser.close();
