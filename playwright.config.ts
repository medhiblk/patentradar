import { defineConfig, chromium, webkit } from "@playwright/test";
import { existsSync } from "node:fs";
const remote = process.env.PATENTRADAR_TEST_URL;
const safari = process.env.PATENTRADAR_BROWSER === "webkit";
export default defineConfig({
  testDir: "./tests/e2e",
  workers: 1,
  use: {
    browserName: safari ? "webkit" : "chromium",
    baseURL: remote || "http://127.0.0.1:3000",
    headless: true,
    launchOptions: {
      executablePath: safari
        ? webkit.executablePath()
        : process.env.CHROMIUM_PATH ||
          (existsSync("/usr/bin/chromium")
            ? "/usr/bin/chromium"
            : chromium.executablePath()),
      ...(safari
        ? {}
        : { args: ["--no-sandbox", "--enable-unsafe-swiftshader"] }),
      ...(remote && process.env.HTTPS_PROXY
        ? { proxy: { server: process.env.HTTPS_PROXY } }
        : {}),
    },
  },
  webServer: remote
    ? undefined
    : {
        command: "npm run start",
        url: "http://127.0.0.1:3000",
        reuseExistingServer: true,
        timeout: 60000,
      },
});
