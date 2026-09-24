import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/api", async () => (await import("../support/fakeApi")).fakeApi);
import { server } from "../support/fakeApi";
import { Form } from "@/components/Form";

beforeEach(() => {
  localStorage.clear();
  server.reset();
});

async function start(lang: "de" | "en", c?: string) {
  render(<Form initialLang={lang} companyTag={c} />);
  await userEvent.click(screen.getByRole("checkbox"));
  await userEvent.click(screen.getByRole("button", { name: /Start/ }));
  await screen.findByText(lang === "en" ? /Your role/ : /Ihre Rolle/);
}

async function choose(name: RegExp) {
  await userEvent.click(screen.getByRole("radio", { name }));
  await userEvent.click(screen.getByRole("button", { name: "OK" }));
}

const only = () => [...server.responses.values()][0];

async function tick(name: RegExp) {
  await userEvent.click(screen.getByRole("checkbox", { name }));
  await userEvent.click(screen.getByRole("button", { name: "OK" }));
}

/** Every row of the activities screen set to one point of the scale, then OK. */
async function everyRow(point: string) {
  for (const row of screen.getAllByRole("radiogroup")) {
    await userEvent.click(within(row).getByRole("radio", { name: point }));
  }
  await userEvent.click(screen.getByRole("button", { name: "OK" }));
}

/** The path to `case`, the first question the model may follow up on. */
async function reachCase() {
  await start("en");
  await choose(/Owner/);
  await screen.findByText(/How many people/);
  await choose(/10–49/);
  await screen.findByText(/Who are your customers/);
  await choose(/Businesses/);
  await screen.findByText(/Think of the last time/);
}

describe("Form", () => {
  it("requires consent before starting", async () => {
    render(<Form initialLang="en" />);
    expect(screen.getByRole("button", { name: /Start/ })).toBeDisabled();
    await userEvent.click(screen.getByRole("checkbox"));
    expect(screen.getByRole("button", { name: /Start/ })).toBeEnabled();
  });

  it("switches language on the welcome screen", async () => {
    render(<Form initialLang="de" />);
    expect(screen.getByRole("heading", { name: /Schweizer Firmen/ })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "English" }));
    expect(screen.getByRole("heading", { name: /Swiss firms/ })).toBeInTheDocument();
    expect(document.documentElement.lang).toBe("en");
  });

  it("switches language while answering, and the answer carries the new one", async () => {
    const { fakeApi } = await import("../support/fakeApi");
    await start("de");
    await userEvent.click(screen.getByRole("button", { name: "English" }));
    expect(await screen.findByText(/Your role/)).toBeInTheDocument();
    await choose(/Owner/);
    expect(fakeApi.postAnswer).toHaveBeenLastCalledWith(expect.any(String), "role", { option: "owner" }, "en");
  });

  it("does not offer the language toggle on the thank-you screen", async () => {
    const { FORM_VERSION } = await import("@/form");
    localStorage.setItem(
      "interview-form",
      JSON.stringify({ version: FORM_VERSION, lang: "de", stage: "done", responseId: null, referenceCode: "0123abcd" }),
    );
    render(<Form initialLang="de" />);
    expect(await screen.findByText(/Vielen Dank/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "English" })).not.toBeInTheDocument();
  });

  it("asks the follow-up on the same screen, with the answer above it", async () => {
    server.followUps.push({ index: 1, text: "Where did you look?" });
    await reachCase();
    await userEvent.type(screen.getByRole("textbox"), "We looked into a supplier.{Enter}");
    expect(await screen.findByText("Where did you look?")).toBeInTheDocument();
    // the question and the answer stay on screen, the answer no longer editable
    expect(screen.getByText(/Think of the last time/)).toBeInTheDocument();
    expect(screen.getByText("We looked into a supplier.")).toBeInTheDocument();
    expect(screen.getByRole("textbox")).toHaveValue("");
  });

  it("sends the follow-up answer with its index, then moves on", async () => {
    const { fakeApi } = await import("../support/fakeApi");
    server.followUps.push({ index: 1, text: "Where did you look?" });
    await reachCase();
    await userEvent.type(screen.getByRole("textbox"), "We looked into a supplier.{Enter}");
    await screen.findByText("Where did you look?");
    await userEvent.type(screen.getByRole("textbox"), "The commercial register.{Enter}");
    await screen.findByText(/how much working time/i);
    expect(fakeApi.postAnswer).toHaveBeenLastCalledWith(
      expect.any(String), "case", { text: "The commercial register." }, "en", 1,
    );
  });

  it("shows a follow-up again that was left unanswered before the reload", async () => {
    server.followUps.push({ index: 1, text: "Where did you look?" });
    await reachCase();
    await userEvent.type(screen.getByRole("textbox"), "We looked into a supplier.{Enter}");
    await screen.findByText("Where did you look?");
    cleanup(); // the participant leaves without answering the follow-up

    render(<Form initialLang="en" />);
    expect(await screen.findByText("Where did you look?")).toBeInTheDocument();
    expect(screen.getByText("We looked into a supplier.")).toBeInTheDocument();
  });

  it("starts a response on the server with the company tag and the language", async () => {
    const { fakeApi } = await import("../support/fakeApi");
    await start("en", "CHE123456789");
    expect(fakeApi.startResponse).toHaveBeenCalledWith({ c: "CHE123456789", lang: "en" });
  });

  it("walks the short path to the thank-you screen with a reference code", async () => {
    await reachCase();
    await userEvent.click(screen.getByRole("button", { name: /think of such a case/ }));
    await screen.findByText(/where does it get stuck/);
    await userEvent.type(screen.getByRole("textbox"), "Finding the right person.{Enter}");
    await screen.findByText(/How often did this happen/);
    await everyRow("Never");
    await screen.findByText(/Who usually does this/);
    await choose(/Mostly me/);
    await screen.findByText(/did it happen that you/);
    await tick(/None of these/);
    await screen.findByText(/Would you be open to/);
    await tick(/neither/);
    expect(await screen.findByText("Thank you")).toBeInTheDocument();
    expect(screen.getByText("00000000")).toBeInTheDocument();
    expect(screen.getByText(/koray\.kaya@ost\.ch/)).toBeInTheDocument();
    expect(only().completed).toBe(true);
  });

  it("walks all fourteen screens when a case is told", async () => {
    await reachCase();
    await userEvent.type(screen.getByRole("textbox"), "I asked a colleague.{Enter}");
    await screen.findByText(/how much working time/i);
    await choose(/Up to 2 hours/);
    await screen.findByText(/Did it cost anything/);
    await tick(/A paid extract or report/);
    await screen.findByText(/did you find what you were looking for/);
    await choose(/Partly/);
    await screen.findByText(/where does it get stuck/);
    await userEvent.type(screen.getByRole("textbox"), "Finding the right person.{Enter}");
    await screen.findByText(/what would a really good result/);
    await userEvent.type(screen.getByRole("textbox"), "A short list I could call.{Enter}");
    await screen.findByText(/How often did this happen/);
    await everyRow("About monthly");
    await screen.findByText(/Who usually does this/);
    await choose(/Mostly me/);
    await screen.findByText(/did it happen that you/);
    await tick(/because there was no time/);
    await screen.findByText(/whom did you ask/);
    await tick(/The company's website/);
    await screen.findByText(/Would you be open to/);
    await tick(/neither/);
    expect(await screen.findByText("Thank you")).toBeInTheDocument();
    expect(Object.keys(only().answers)).toHaveLength(14);
  });

  it("resumes after a reload from the server", async () => {
    const first = render(<Form initialLang="en" />);
    await userEvent.click(screen.getByRole("checkbox"));
    await userEvent.click(screen.getByRole("button", { name: /Start/ }));
    await choose(/Sales/);
    await screen.findByText(/How many people/);
    first.unmount();
    render(<Form initialLang="de" />);
    expect(await screen.findByText(/How many people/)).toBeInTheDocument();
    expect(localStorage.getItem("interview-form")).not.toContain("sales");
  });

  it("starts over when the server no longer knows the response", async () => {
    const first = render(<Form initialLang="en" />);
    await userEvent.click(screen.getByRole("checkbox"));
    await userEvent.click(screen.getByRole("button", { name: /Start/ }));
    await screen.findByText(/Your role/);
    first.unmount();
    server.reset(); // e.g. deleted by the seven-day cleanup
    render(<Form initialLang="en" />);
    expect(await screen.findByRole("button", { name: /Start/ })).toBeInTheDocument();
  });

  it("keeps the answer on screen and says so when saving fails", async () => {
    await start("en");
    server.failNextAnswer = true;
    await userEvent.click(screen.getByRole("radio", { name: /Sales/ }));
    await userEvent.click(screen.getByRole("button", { name: "OK" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/could not be saved/);
    expect(screen.getByRole("radio", { name: /Sales/ })).toHaveAttribute("aria-checked", "true");
    await userEvent.click(screen.getByRole("button", { name: "OK" }));
    expect(await screen.findByText(/How many people/)).toBeInTheDocument();
  });

  it("Back returns to the previous answer", async () => {
    await start("en");
    await choose(/Sales/);
    await screen.findByText(/How many people/);
    await userEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByRole("radio", { name: /Sales/ })).toBeChecked();
  });

  it("OK after Back walks forward one screen, not to the first unanswered", async () => {
    await start("en");
    await choose(/Sales/);
    await screen.findByText(/How many people/);
    await choose(/10–49/);
    await screen.findByText(/Who are your customers/);
    await userEvent.click(screen.getByRole("button", { name: "Back" }));
    await userEvent.click(screen.getByRole("button", { name: "Back" }));
    await userEvent.click(screen.getByRole("button", { name: "OK" }));
    expect(await screen.findByText(/How many people/)).toBeInTheDocument();
  });

  it("drops what the escape skips, on the server too, when the case is escaped after all", async () => {
    await reachCase();
    await userEvent.type(screen.getByRole("textbox"), "I asked a colleague.{Enter}");
    await screen.findByText(/how much working time/i);
    await choose(/Up to 2 hours/);
    await screen.findByText(/Did it cost anything/);
    expect(only().answers.duration).toEqual({ option: "lt2h" });
    await userEvent.click(screen.getByRole("button", { name: "Back" }));
    await userEvent.click(screen.getByRole("button", { name: "Back" }));
    await userEvent.click(screen.getByRole("button", { name: /think of such a case/ }));
    expect(await screen.findByText(/where does it get stuck/)).toBeInTheDocument();
    expect(only().answers.case).toEqual({ option: "none" });
    expect(only().answers.duration).toBeUndefined();
  });

  it("ArrowUp inside a text answer moves the cursor, it does not go back", async () => {
    await reachCase();
    await userEvent.type(screen.getByRole("textbox"), "first line{Shift>}{Enter}{/Shift}second{ArrowUp}");
    expect(screen.getByText(/Think of the last time/)).toBeInTheDocument();
  });

  it("ArrowUp does not leave a question while the model's follow-up is on screen", async () => {
    server.followUps.push({ index: 1, text: "Where did you look?" });
    await reachCase();
    await userEvent.type(screen.getByRole("textbox"), "We looked into a supplier.{Enter}");
    await screen.findByText("Where did you look?");
    (document.activeElement as HTMLElement | null)?.blur();
    await userEvent.keyboard("{ArrowUp}");
    expect(screen.getByText(/Think of the last time/)).toBeInTheDocument();
    expect(screen.queryByText(/Who are your customers/)).not.toBeInTheDocument();
  });

  it("ArrowUp elsewhere goes back", async () => {
    await start("en");
    await choose(/Sales/);
    await screen.findByText(/How many people/);
    await userEvent.keyboard("{ArrowUp}");
    expect(screen.getByText(/Your role/)).toBeInTheDocument();
  });
});
