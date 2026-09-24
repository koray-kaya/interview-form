// Walks the shortest complete path in English, as a participant on a phone
// would: the case escaped, every activity "Never". Proves the page, the API
// and the database work together, and that the SMOKE tag never reached the
// model: every stored answer came back without a follow-up.
import { expect, test } from "@playwright/test";

test("the short path reaches the thank-you screen without a model call", async ({ page }) => {
  const followUps: unknown[] = [];
  page.on("response", async (response) => {
    if (/\/api\/responses\/[^/]+\/answers$/.test(response.url()) && response.request().method() === "POST") {
      followUps.push((await response.json()).followUp);
    }
  });

  await page.goto("/?l=en&c=SMOKE");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Start" }).click();

  const choose = async (name: RegExp) => {
    await page.getByRole("radio", { name }).click();
    await page.getByRole("button", { name: "OK" }).click();
  };
  const tick = async (name: RegExp) => {
    await page.getByRole("checkbox", { name }).click();
    await page.getByRole("button", { name: "OK" }).click();
  };

  await expect(page.getByText("Your role")).toBeVisible();
  await choose(/Owner/);
  await expect(page.getByText(/How many people/)).toBeVisible();
  await choose(/10–49/);
  await expect(page.getByText(/Who are your customers/)).toBeVisible();
  await choose(/Businesses/);

  await expect(page.getByText(/Think of the last time/)).toBeVisible();
  await page.getByRole("button", { name: /think of such a case/ }).click();

  await expect(page.getByText(/where does it get stuck/)).toBeVisible();
  // on a phone Enter makes a line break; OK sends the answer
  await page.getByRole("textbox").fill("Smoke test, not a participant.");
  await page.getByRole("button", { name: "OK" }).click();

  await expect(page.getByText(/How often did this happen/)).toBeVisible();
  for (const row of await page.getByRole("radiogroup").all()) {
    await row.getByRole("radio", { name: "Never" }).click();
  }
  await page.getByRole("button", { name: "OK" }).click();

  await expect(page.getByText(/Who usually does this/)).toBeVisible();
  await choose(/Mostly me/);
  await expect(page.getByText(/did it happen that you/)).toBeVisible();
  await tick(/None of these/);
  await expect(page.getByText(/Would you be open to/)).toBeVisible();
  await tick(/neither/);

  await expect(page.getByText("Thank you")).toBeVisible();
  await expect(page.getByText(/^[0-9a-f]{8}$/)).toBeVisible();
  expect(followUps.length).toBeGreaterThanOrEqual(9);
  expect(followUps.every((followUp) => followUp === null)).toBe(true);
});
