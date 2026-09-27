// `npx tsx scripts/readme-screenshot.ts` with `npm run dev` running — redraws
// docs/assets/follow-up.png, the picture at the top of the README.
// Every API call is answered here in the browser, so nothing reaches the
// database or the model: no row is written and nothing is spent. The answer
// is the invented eval fixture "discovery-without-steps"
// (evals/fixtures.ts), and the follow-up is the question the model wrote for
// it in the eval run of 2026-09-24. Wrapped in main() because tsx runs this
// file as CommonJS, where a top-level await is not allowed.
import { chromium, devices, type Route } from "@playwright/test";

const BASE = process.env.SCREENSHOT_URL ?? "http://localhost:3000";
const ANSWER = "We were looking for new customers in our region.";
const FOLLOW_UP = "How did you go about finding them, where did you look or whom did you ask?";
const RESPONSE_ID = "00000000-0000-4000-8000-000000000000";

async function answerApi(route: Route) {
  const request = route.request();
  const path = new URL(request.url()).pathname;
  const json = (body: unknown) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  if (path === "/api/responses" && request.method() === "POST") return json({ id: RESPONSE_ID, probeAllowed: true });
  if (path.endsWith("/answers")) {
    const { questionId, followupIndex } = request.postDataJSON();
    const asks = questionId === "case" && followupIndex === 0;
    return json({ followUp: asks ? { index: 1, text: FOLLOW_UP } : null });
  }
  return route.fulfill({ status: 404, contentType: "application/json", body: "{}" });
}

async function main() {
  const browser = await chromium.launch();
  // scale 2 instead of the phone's 2.625 keeps the file small
  const page = await browser.newPage({ ...devices["Pixel 7"], deviceScaleFactor: 2 });
  await page.route("**/api/**", answerApi);

  await page.goto(`${BASE}/?l=en`);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Start" }).click();
  for (const option of [/Owner/, /10–49/, /Businesses/]) {
    await page.getByRole("radio", { name: option }).click();
    await page.getByRole("button", { name: "OK" }).click();
  }

  await page.getByText(/Think of the last time/).waitFor();
  await page.getByRole("textbox").fill(ANSWER);
  await page.getByRole("button", { name: "OK" }).click();
  await page.getByText(FOLLOW_UP).waitFor();
  await page.waitForTimeout(600); // let the screen's entry animation finish
  // the dev server's own badge is not part of the form
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });

  await page.screenshot({ path: "docs/assets/follow-up.png" });
  await browser.close();
  console.log("docs/assets/follow-up.png");
}

main();
