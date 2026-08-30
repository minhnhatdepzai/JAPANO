import { defineConfig, devices } from "@playwright/test";

// Smoke AI thật chạy trên GPU nên nằm ngoài bộ mặc định; bật bằng
// JAPANO_E2E_REAL_AI=1 và nó tự chuyển sang một project riêng, chạy tuần tự.
const realAi = process.env.JAPANO_E2E_REAL_AI === "1";

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  // Backend dùng chung có rate limit thật (600 lượt/cửa sổ cho API, 20 cho auth).
  // Hai worker là mức chạy hết bộ test mà không kích hoạt lớp bảo vệ đó.
  workers: Number(process.env.PLAYWRIGHT_WORKERS || 2),
  timeout: 60_000,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:4200",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    locale: "vi-VN",
  },
  projects: [
    {
      name: "mobile-390",
      testIgnore: /(real-ai|global-setup)/,
      use: { ...devices["iPhone 13"], browserName: "chromium", isMobile: false, hasTouch: true },
    },
    {
      name: "desktop-1440",
      testIgnore: /(real-ai|global-setup)/,
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 1000 } },
    },
    ...(realAi
      ? [{
        name: "real-ai",
        testMatch: /real-ai\.spec\.ts/,
        fullyParallel: false,
        workers: 1,
        use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 1000 } },
      }]
      : []),
  ],
  webServer: process.env.PLAYWRIGHT_SKIP_SERVER ? undefined : {
    command: "npm run dev",
    url: "http://127.0.0.1:4200",
    reuseExistingServer: true,
    timeout: 180_000,
  },
});
