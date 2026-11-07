import { chromium } from "playwright-core";

const [token, cid] = [process.argv[2], process.argv[3]];
const URL = "http://localhost:5173";
const SHOTS = "./shots/";
const IMG = "./fixtures/sample.png";
const label = process.argv[4] ?? "";
let failures = 0;
const check = (name, ok, extra = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  — " + extra : ""}`);
  if (!ok) failures++;
};

// האם ההודעה האחרונה גלויה מעל שורת ההקלדה (ולא מוסתרת מאחוריה)
const lastVisible = (p) => p.evaluate(() => {
  const last = [...document.querySelectorAll(".message")].at(-1).getBoundingClientRect();
  const input = document.querySelector(".chat-input").getBoundingClientRect();
  return { ok: last.bottom <= input.top + 1, lastBottom: Math.round(last.bottom), inputTop: Math.round(input.top) };
});

const browser = await chromium.launch({ channel: "msedge", headless: true });
for (const [name, viewport, mobile] of [["desktop", { width: 1280, height: 800 }, false], ["mobile", { width: 360, height: 740 }, true]]) {
  const ctx = await browser.newContext({ viewport, isMobile: mobile, hasTouch: mobile, colorScheme: "light" });
  await ctx.addInitScript((t) => localStorage.setItem("token", t), token);
  const p = await ctx.newPage();
  await p.goto(`${URL}/c/${cid}`);
  await p.locator(".message-assistant .markdown pre").waitFor();
  await p.waitForTimeout(600);
  let r = await lastVisible(p);
  check(`[${name}] long chat: last message visible after load`, r.ok, JSON.stringify(r));
  await p.screenshot({ path: SHOTS + `fix-${label}-${name}-load.png` });

  // שורת הקלט גדלה: טקסט ארוך בכמה שורות
  const input = p.getByLabel("Message", { exact: true });
  await input.fill("line 1\nline 2\nline 3\nline 4\nline 5\nline 6");
  await p.waitForTimeout(400);
  r = await lastVisible(p);
  check(`[${name}] input grows (6 lines): last message still visible`, r.ok, JSON.stringify(r));

  // תמונה מצורפת
  await p.locator('input[type="file"]').setInputFiles(IMG);
  await p.getByAltText("Attached image preview").waitFor();
  await p.waitForTimeout(400);
  r = await lastVisible(p);
  check(`[${name}] image attached: last message still visible`, r.ok, JSON.stringify(r));
  await p.screenshot({ path: SHOTS + `fix-${label}-${name}-grown.png` });

  // קוד משמאל לימין בתשובה בעברית
  const dirs = await p.evaluate(() => {
    const last = [...document.querySelectorAll(".message-assistant .markdown")].at(-1);
    return {
      inline: getComputedStyle(last.querySelector("p code")).direction,
      block: getComputedStyle(last.querySelector("pre")).direction,
      blockCode: getComputedStyle(last.querySelector("pre code")).direction,
    };
  });
  check(`[${name}] inline and block code are ltr`, dirs.inline === "ltr" && dirs.block === "ltr" && dirs.blockCode === "ltr", JSON.stringify(dirs));
  await ctx.close();
}
console.log(failures === 0 ? "ALL PASSED" : `${failures} FAILED`);
await browser.close();
