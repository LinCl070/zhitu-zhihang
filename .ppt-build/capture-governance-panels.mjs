// Re-open the latest simulation from history and capture individual panels for slides.
// Read-only: opening history and generating a report do not create runs or audit events.
import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const workspace = "D:/基于大模型的教育管理应用创新赛";
const outDir = path.join(workspace, "output/playwright/governance");
const env = Object.fromEntries(
  (await fs.readFile(path.join(workspace, ".env"), "utf8"))
    .split(/\r?\n/)
    .filter((line) => line.includes("=") && !line.startsWith("#"))
    .map((line) => [line.slice(0, line.indexOf("=")), line.slice(line.indexOf("=") + 1)]),
);

const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const page = await (await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1.5 })).newPage();
await page.goto("http://localhost:5173");
await page.locator('input[autocomplete="username"]').fill(env.ADMIN_BOOTSTRAP_USERNAME);
await page.locator('input[type="password"]').fill(env.ADMIN_BOOTSTRAP_PASSWORD);
await page.getByRole("button", { name: "登录", exact: true }).click();
await page.locator('[data-nav="simulation"]').click();
await page.getByRole("button", { name: "查看" }).first().click();
await page.getByRole("button", { name: "生成策略报告" }).waitFor({ timeout: 30000 });

const panel = (title) => page.locator(".panel", { has: page.locator("h3.panel-title", { hasText: title }) }).first();
async function capture(title, name) {
  const target = panel(title);
  await target.scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  await target.screenshot({ path: path.join(outDir, `${name}.png`) });
  console.log("saved", name);
}

await capture("逐周指标对比", "p1-weekly-chart");
await capture("终点指标对比", "p2-endpoint-table");
await page.getByRole("button", { name: "生成策略报告" }).click();
await page.locator(".strategy-report").waitFor({ timeout: 30000 });
await page.waitForTimeout(800);
await page.locator(".strategy-report").screenshot({ path: path.join(outDir, "p3-strategy-report.png") });
console.log("saved", "p3-strategy-report");
await browser.close();
