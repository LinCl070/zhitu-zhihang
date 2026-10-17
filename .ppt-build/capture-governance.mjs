// Capture governance demo screenshots for the defense deck (appendix D / backup).
// Requires backend (FASTGPT_MODE=mock) on :8000, frontend on :5173, and seed_governance_demo.
import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const workspace = "D:/基于大模型的教育管理应用创新赛";
const outDir = path.join(workspace, "output/playwright/governance");
const baseUrl = "http://localhost:5173";
await fs.mkdir(outDir, { recursive: true });

const env = Object.fromEntries(
  (await fs.readFile(path.join(workspace, ".env"), "utf8"))
    .split(/\r?\n/)
    .filter((line) => line.includes("=") && !line.startsWith("#"))
    .map((line) => [line.slice(0, line.indexOf("=")), line.slice(line.indexOf("=") + 1)]),
);

const browser = await chromium.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
});

async function session(username, password) {
  const context = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1.5 });
  const page = await context.newPage();
  await page.goto(baseUrl);
  await page.locator('input[autocomplete="username"]').fill(username);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await page.locator(".nav-item").first().waitFor();
  return page;
}

async function shot(page, name) {
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(outDir, `${name}.png`) });
  console.log("saved", name);
}

// 1. Counselor risk board.
const teacher = await session("demo_teacher", env.DEMO_ACCOUNT_PASSWORD);
await teacher.locator('[data-nav="risks"]').click();
await teacher.locator(".risk-card-head").first().waitFor();
await shot(teacher, "1-risk-board");

// 2. Admin insights on synthetic data.
const admin = await session(env.ADMIN_BOOTSTRAP_USERNAME, env.ADMIN_BOOTSTRAP_PASSWORD);
await admin.locator('[data-nav="insights"]').click();
await admin.getByRole("button", { name: "仿真合成" }).click();
await admin.waitForTimeout(1500);
await shot(admin, "2-insights-synthetic");

// 3. Simulation with four scenarios at default parameters.
await admin.locator('[data-nav="simulation"]').click();
for (const label of ["技能补强培训", "岗位精准推送"]) {
  const box = admin.locator("label.scenario-check", { hasText: label }).locator("input");
  if (!(await box.isChecked())) await box.check();
}
await admin.getByRole("button", { name: "运行仿真" }).click();
await admin.getByRole("button", { name: "生成策略报告" }).waitFor({ timeout: 60000 });
await shot(admin, "3-simulation-result");
await admin.screenshot({ path: path.join(outDir, "3b-simulation-full.png"), fullPage: true });

// 4. Strategy report.
await admin.getByRole("button", { name: "生成策略报告" }).click();
await admin.getByRole("button", { name: "生成策略报告" }).waitFor({ state: "visible", timeout: 30000 });
await admin.waitForTimeout(1500);
await admin.screenshot({ path: path.join(outDir, "4-strategy-report.png"), fullPage: true });
console.log("saved", "4-strategy-report");

// 5. Adopt job push, then show the audit record.
const pushRow = admin.locator("tr", { hasText: "岗位精准推送" }).filter({ has: admin.getByRole("button", { name: "采纳" }) });
await pushRow.getByRole("button", { name: "采纳" }).first().click();
await admin.waitForTimeout(1500);
await admin.locator('[data-nav="audit"]').click();
await admin.locator("#admin-audit-table").waitFor();
await shot(admin, "5-audit-adopted");

await browser.close();
