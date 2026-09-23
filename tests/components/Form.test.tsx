import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
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

describe("Form", () => {
  it("requires consent before starting", async () => {
    render(<Form initialLang="en" />);
    expect(screen.getByRole("button", { name: /Start/ })).toBeDisabled();
    await userEvent.click(screen.getByRole("checkbox"));
    expect(screen.getByRole("button", { name: /Start/ })).toBeEnabled();
  });

  it("switches language on the welcome screen", async () => {
    render(<Form initialLang="de" />);
    expect(screen.getByRole("heading", { name: /Schweizer Unternehmen/ })).toBeInTheDocument();
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

  it("starts a response on the server with the company tag and the language", async () => {
    const { fakeApi } = await import("../support/fakeApi");
    await start("en", "CHE123456789");
    expect(fakeApi.startResponse).toHaveBeenCalledWith({ c: "CHE123456789", lang: "en" });
  });

  it("walks the short path to the thank-you screen with a reference code", async () => {
    await start("en");
    await choose(/Owner/);
    await screen.findByText(/How many people/);
    await choose(/10–49/);
    await screen.findByText(/did you look into another company/);
    await userEvent.click(screen.getByRole("checkbox", { name: /none of these/ }));
    await userEvent.click(screen.getByRole("button", { name: "OK" }));
    await screen.findByText(/where does it get stuck/);
    await userEvent.type(screen.getByRole("textbox"), "Finding the right person.{Enter}");
    await screen.findByText(/what would a really good result/);
    await userEvent.type(screen.getByRole("textbox"), "A short list I could call.{Enter}");
    await screen.findByText(/Would you be open to/);
    await userEvent.click(screen.getByRole("checkbox", { name: /neither/ }));
    await userEvent.click(screen.getByRole("button", { name: "OK" }));
    expect(await screen.findByText("Thank you")).toBeInTheDocument();
    expect(screen.getByText("00000000")).toBeInTheDocument();
    expect(screen.getByText(/koray\.kaya@ost\.ch/)).toBeInTheDocument();
    expect(only().completed).toBe(true);
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
    await screen.findByText(/did you look into another company/);
    await userEvent.click(screen.getByRole("button", { name: "Back" }));
    await userEvent.click(screen.getByRole("button", { name: "Back" }));
    await userEvent.click(screen.getByRole("button", { name: "OK" }));
    expect(await screen.findByText(/How many people/)).toBeInTheDocument();
  });

  it("drops the case answer on the server when relations is changed to none", async () => {
    await start("en");
    await choose(/Sales/);
    await screen.findByText(/How many people/);
    await choose(/10–49/);
    await screen.findByText(/did you look into another company/);
    await userEvent.click(screen.getByRole("checkbox", { name: /a new customer/ }));
    await userEvent.click(screen.getByRole("button", { name: "OK" }));
    await screen.findByText(/most recent case/);
    await userEvent.type(screen.getByRole("textbox"), "I asked a colleague.{Enter}");
    await screen.findByText(/how long did that take/i);
    expect(only().answers.case).toEqual({ text: "I asked a colleague." });
    await userEvent.click(screen.getByRole("button", { name: "Back" }));
    await userEvent.click(screen.getByRole("button", { name: "Back" }));
    await userEvent.click(screen.getByRole("checkbox", { name: /none of these/ }));
    await userEvent.click(screen.getByRole("button", { name: "OK" }));
    expect(await screen.findByText(/where does it get stuck/)).toBeInTheDocument();
    expect(only().answers.case).toBeUndefined();
  });

  it("ArrowUp inside a text answer moves the cursor, it does not go back", async () => {
    await start("en");
    await choose(/Sales/);
    await screen.findByText(/How many people/);
    await choose(/10–49/);
    await screen.findByText(/did you look into another company/);
    await userEvent.click(screen.getByRole("checkbox", { name: /a new customer/ }));
    await userEvent.click(screen.getByRole("button", { name: "OK" }));
    await screen.findByText(/most recent case/);
    await userEvent.type(screen.getByRole("textbox"), "first line{Shift>}{Enter}{/Shift}second{ArrowUp}");
    expect(screen.getByText(/most recent case/)).toBeInTheDocument();
  });

  it("ArrowUp elsewhere goes back", async () => {
    await start("en");
    await choose(/Sales/);
    await screen.findByText(/How many people/);
    await userEvent.keyboard("{ArrowUp}");
    expect(screen.getByText(/Your role/)).toBeInTheDocument();
  });
});
