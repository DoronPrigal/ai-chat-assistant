import { chromium } from "playwright-core";

const token = process.argv[2];
const SHOTS = "./shots/";
let failures = 0;
const check = (name, ok, extra = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  — " + extra : ""}`);
  if (!ok) failures++;
};
const browser = await chromium.launch({ channel: "msedge", headless: true });

for (const scheme of ["light", "dark"]) {
  // נייד: כפתור הסגירה באותו מקום של כפתור הפתיחה
  const m = await browser.newContext({ viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true, colorScheme: scheme });
  await m.addInitScript((t) => localStorage.setItem("token", t), token);
  const p = await m.newPage();
  await p.goto("http://localhost:5173/");
  await p.locator(".empty-state").waitFor();
  const opener = await p.getByRole("button", { name: "Show conversations" }).boundingBox();
  await p.getByRole("button", { name: "Show conversations" }).tap();
  await p.waitForTimeout(400);
  const closer = await p.getByRole("button", { name: "Close conversations" }).boundingBox();
  const newChat = await p.locator("#sidebar").getByRole("link", { name: "New chat" }).boundingBox();
  const dx = Math.abs(opener.x - closer.x), dy = Math.abs(opener.y - closer.y);
  check(`[${scheme}] X is where the open button was (offset ${dx.toFixed(0)}px, ${dy.toFixed(0)}px)`, dx <= 1 && dy <= 1);
  check(`[${scheme}] New chat is to the right of X`, newChat.x > closer.x + closer.width);
  const newChatCenter = { x: opener.x + opener.width / 2, y: opener.y + opener.height / 2 };
  const hit = await p.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.closest("button,a")?.getAttribute("aria-label") ?? document.elementFromPoint(x, y)?.closest("button,a")?.textContent, newChatCenter);
  check(`[${scheme}] tapping where the open button was hits Close, not New chat`, hit === "Close conversations", hit);
  await p.screenshot({ path: SHOTS + `drawer-${scheme}.png` });
  await p.getByRole("button", { name: "Close conversations" }).tap();
  await m.close();

  // הלוגו: SVG בכותרת, הקו בצבע הטקסט והניצוץ בצבע ההדגשה של המצב
  const d = await browser.newContext({ viewport: { width: 1280, height: 400 }, colorScheme: scheme });
  const dp = await d.newPage();
  await dp.goto("http://localhost:5173/about");
  await dp.locator(".brand svg").waitFor();
  await dp.waitForTimeout(600); // אחרי מעבר הצבעים בטעינה
  const colors = await dp.evaluate(() => {
    const svg = document.querySelector(".brand svg");
    const [line, spark] = svg.querySelectorAll("path");
    return { line: getComputedStyle(line).stroke, text: getComputedStyle(document.body).color, spark: getComputedStyle(spark).fill };
  });
  const expectedSpark = scheme === "light" ? "rgb(37, 107, 97)" : "rgb(139, 133, 255)";
  check(`[${scheme}] logo outline uses the text color`, colors.line === colors.text, JSON.stringify(colors));
  check(`[${scheme}] logo spark uses the theme accent`, colors.spark === expectedSpark, colors.spark);
  await dp.screenshot({ path: SHOTS + `logo-header-${scheme}.png`, clip: { x: 0, y: 0, width: 420, height: 60 } });
  await d.close();
}
console.log(failures === 0 ? "ALL PASSED" : `${failures} FAILED`);
await browser.close();
