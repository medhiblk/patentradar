import { chromium } from "@playwright/test";
import { existsSync } from "node:fs";
import { writeFile } from "node:fs/promises";
const base = process.env.PATENTRADAR_TEST_URL || "http://127.0.0.1:3000";
const browser = await chromium.launch({
  executablePath:
    process.env.CHROMIUM_PATH ||
    (existsSync("/usr/bin/chromium")
      ? "/usr/bin/chromium"
      : chromium.executablePath()),
  args: ["--no-sandbox"],
  ...(base.startsWith("https:") && process.env.HTTPS_PROXY
    ? { proxy: { server: process.env.HTTPS_PROXY } }
    : {}),
});
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  await page.goto(base, { waitUntil: "networkidle" });
  const report = await page.evaluate(() => {
    const resources = performance
      .getEntriesByType("resource")
      .map((r) => ({
        name: new URL(r.name).pathname,
        bytes: r.encodedBodySize,
      }));
    return {
      resources,
      jsBytes: resources
        .filter((r) => r.name.endsWith(".js"))
        .reduce((n, r) => n + r.bytes, 0),
      domNodes: document.querySelectorAll("*").length,
    };
  });
  report.base = base;
  report.checkedAt = new Date().toISOString();
  report.method =
    "Fresh Chromium context, desktop 1440x1000, network idle, encoded resource bytes; not a Lighthouse score.";
  if (process.env.FRONTEND_MEASURE_OUTPUT)
    await writeFile(
      process.env.FRONTEND_MEASURE_OUTPUT,
      JSON.stringify(report, null, 2) + "\n",
    );
  if (process.env.FRONTEND_SCREENSHOT)
    await page.screenshot({
      path: process.env.FRONTEND_SCREENSHOT,
      fullPage: true,
    });
  console.log(
    JSON.stringify({
      jsBytes: report.jsBytes,
      resources: report.resources.length,
      domNodes: report.domNodes,
      apiRequests: report.resources.filter((r) => r.name.startsWith("/api/"))
        .length,
    }),
  );
} finally {
  await browser.close();
}
