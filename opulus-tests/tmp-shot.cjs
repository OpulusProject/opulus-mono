const { chromium } = require("playwright");
const { readFileSync } = require("node:fs");
const { cookie } = JSON.parse(readFileSync("/tmp/variant-session.json", "utf8"));
const [name, ...rest] = cookie.split(";")[0].split("=");
const value = rest.join("=");
const out = process.argv[2] ?? "/tmp/shots";
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 760 }, deviceScaleFactor: 2 });
  await ctx.addCookies([{ name, value, domain: "localhost", path: "/" }]);
  for (const v of ["a", "b", "c", "d", "e"]) {
    const page = await ctx.newPage();
    await page.goto(`http://localhost:5173/investments?dv=${v}`);
    const card = page.locator('section[aria-label="Portfolio summary"]');
    await card.waitFor();
    await page.waitForTimeout(800);
    await card.screenshot({ path: `${out}/summary-${v}.png` });
    await page.getByText("SBSI", { exact: true }).first().click();
    const sheet = page.locator('[role="dialog"]');
    await sheet.waitFor();
    await page.waitForTimeout(1200);
    await sheet.screenshot({ path: `${out}/drawer-${v}.png`, clip: undefined });
    await page.close();
  }
  await browser.close();
})();
