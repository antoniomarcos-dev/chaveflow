import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  workers: 1,
  fullyParallel: false,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:3101",
    viewport: { width: 1440, height: 1000 },
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: {
    command:
      "node --import=tsx --import=./e2e/runtime.ts node_modules/next/dist/bin/next dev --hostname 127.0.0.1 --port 3101",
    url: "http://127.0.0.1:3101/login",
    timeout: 120_000,
    reuseExistingServer: false,
    env: {
      CHAVEFLOW_BROWSER_TEST_RUNTIME: "true",
      SUPABASE_URL: "https://chaveflow-e2e.invalid",
      SUPABASE_SECRET_KEY: "sb_secret_isolated_browser_tests",
      CHAVEFLOW_SESSION_SECRET:
        "isolated-browser-test-secret-1234567890-abcdefghijklmnopqrstuvwxyz",
      CHAVEFLOW_APP_URL: "http://127.0.0.1:3101",
    },
  },
});
