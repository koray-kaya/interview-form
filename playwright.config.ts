// The production smoke test (M4): one browser, a phone-sized screen, against
// the URL in SMOKE_URL — the deployed site after each production deploy, or
// `npm run dev` locally. It walks the short path with the reserved tag
// ?c=SMOKE, which never reaches the model and is deleted by the daily cron.
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  retries: 1,
  reporter: [["list"]],
  use: {
    baseURL: process.env.SMOKE_URL ?? "http://localhost:3000",
  },
  projects: [{ name: "phone", use: { ...devices["Pixel 7"] } }],
});
