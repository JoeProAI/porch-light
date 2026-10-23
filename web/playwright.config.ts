import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  workers: 1,
  timeout: 45000,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:3101",
    launchOptions: {
      executablePath: process.env.PLAYWRIGHT_CHROME ?? "C:/Program Files/Google/Chrome/Application/chrome.exe",
      args: process.env.PLAYWRIGHT_CHROME ? ["--use-gl=angle", "--use-angle=swiftshader"] : [],
    },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    contextOptions: { reducedMotion: "reduce" },
  },
  projects: [
    { name: "desktop", use: { viewport: { width: 1280, height: 900 } } },
    { name: "mobile", use: { viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true } },
  ],
});
