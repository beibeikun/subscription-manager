import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "e2e",
  fullyParallel: false,
  workers: 1,
  use: { baseURL: "http://127.0.0.1:3177", trace: "retain-on-failure" },
  webServer: {
    command: "node dist-server/server/index.js",
    url: "http://127.0.0.1:3177/api/v1/health",
    reuseExistingServer: false,
    env: {
      PORT: "3177",
      DATA_DIR: "work/e2e-" + Date.now(),
      INIT_ADMIN_PASSWORD: "e2e-password-12345",
      ENCRYPTION_KEY: "a".repeat(64),
    },
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    {
      name: "mobile",
      use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" },
    },
  ],
});
