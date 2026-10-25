import { defineConfig } from "@playwright/test";
const remote = process.env.PATENTRADAR_TEST_URL;
export default defineConfig({
  testDir: "./tests/e2e",
  workers: 1,
  use: {
    baseURL: remote || "http://127.0.0.1:3000",
    headless: true,
    launchOptions: {
      executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
      args: ["--no-sandbox", "--enable-unsafe-swiftshader"],
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
