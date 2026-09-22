import { beforeEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Form } from "@/components/Form";

beforeEach(() => localStorage.clear());

async function start(lang: "de" | "en") {
  render(<Form initialLang={lang} />);
  await userEvent.click(screen.getByRole("checkbox"));
  await userEvent.click(screen.getByRole("button", { name: /Start/ }));
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
    expect(screen.getByRole("heading", { name: /Schweizer Unternehmen/ })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "English" }));
    expect(screen.getByRole("heading", { name: /Swiss firms/ })).toBeInTheDocument();
    expect(document.documentElement.lang).toBe("en");
  });

  it("walks the short path: none of these skips case and duration", async () => {
    await start("en");
    await userEvent.click(screen.getByRole("radio", { name: /Owner/ }));
    await userEvent.click(screen.getByRole("button", { name: "OK" }));
    await userEvent.click(screen.getByRole("radio", { name: /10–49/ }));
    await userEvent.click(screen.getByRole("button", { name: "OK" }));
    await userEvent.click(screen.getByRole("checkbox", { name: /none of these/ }));
    await userEvent.click(screen.getByRole("button", { name: "OK" }));
    expect(screen.getByText(/where does it get stuck/)).toBeInTheDocument();
    await userEvent.type(screen.getByRole("textbox"), "Finding the right person.{Enter}");
    await userEvent.type(screen.getByRole("textbox"), "A short list I could call.{Enter}");
    await userEvent.click(screen.getByRole("checkbox", { name: /neither/ }));
    await userEvent.click(screen.getByRole("button", { name: "OK" }));
    expect(screen.getByText("Thank you")).toBeInTheDocument();
  });

  it("resumes after a reload", async () => {
    const first = render(<Form initialLang="en" />);
    await userEvent.click(screen.getByRole("checkbox"));
    await userEvent.click(screen.getByRole("button", { name: /Start/ }));
    await userEvent.click(screen.getByRole("radio", { name: /Sales/ }));
    await userEvent.click(screen.getByRole("button", { name: "OK" }));
    first.unmount();
    render(<Form initialLang="de" />);
    expect(await screen.findByText(/How many people/)).toBeInTheDocument();
  });

  it("Back returns to the previous answer", async () => {
    await start("en");
    await userEvent.click(screen.getByRole("radio", { name: /Sales/ }));
    await userEvent.click(screen.getByRole("button", { name: "OK" }));
    await userEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByRole("radio", { name: /Sales/ })).toBeChecked();
  });

  it("OK after Back walks forward one screen, not to the first unanswered", async () => {
    await start("en");
    await userEvent.click(screen.getByRole("radio", { name: /Sales/ }));
    await userEvent.click(screen.getByRole("button", { name: "OK" }));
    await userEvent.click(screen.getByRole("radio", { name: /10–49/ }));
    await userEvent.click(screen.getByRole("button", { name: "OK" }));
    await userEvent.click(screen.getByRole("button", { name: "Back" }));
    await userEvent.click(screen.getByRole("button", { name: "Back" }));
    await userEvent.click(screen.getByRole("button", { name: "OK" }));
    expect(screen.getByText(/How many people/)).toBeInTheDocument();
  });

  it("drops the case answer when relations is changed to none", async () => {
    await start("en");
    await userEvent.click(screen.getByRole("radio", { name: /Sales/ }));
    await userEvent.click(screen.getByRole("button", { name: "OK" }));
    await userEvent.click(screen.getByRole("radio", { name: /10–49/ }));
    await userEvent.click(screen.getByRole("button", { name: "OK" }));
    await userEvent.click(screen.getByRole("checkbox", { name: /a new customer/ }));
    await userEvent.click(screen.getByRole("button", { name: "OK" }));
    await userEvent.type(screen.getByRole("textbox"), "I asked a colleague.{Enter}");
    await userEvent.click(screen.getByRole("button", { name: "Back" }));
    await userEvent.click(screen.getByRole("button", { name: "Back" }));
    await userEvent.click(screen.getByRole("checkbox", { name: /a new customer/ }));
    await userEvent.click(screen.getByRole("checkbox", { name: /none of these/ }));
    await userEvent.click(screen.getByRole("button", { name: "OK" }));
    expect(screen.getByText(/where does it get stuck/)).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem("interview-form")!).answers.case).toBeUndefined();
  });

  it("ArrowUp inside a text answer moves the cursor, it does not go back", async () => {
    await start("en");
    await userEvent.click(screen.getByRole("radio", { name: /Sales/ }));
    await userEvent.click(screen.getByRole("button", { name: "OK" }));
    await userEvent.click(screen.getByRole("radio", { name: /10–49/ }));
    await userEvent.click(screen.getByRole("button", { name: "OK" }));
    await userEvent.click(screen.getByRole("checkbox", { name: /a new customer/ }));
    await userEvent.click(screen.getByRole("button", { name: "OK" }));
    await userEvent.type(screen.getByRole("textbox"), "first line{Shift>}{Enter}{/Shift}second{ArrowUp}");
    expect(screen.getByText(/most recent case/)).toBeInTheDocument();
  });

  it("ArrowUp elsewhere goes back", async () => {
    await start("en");
    await userEvent.click(screen.getByRole("radio", { name: /Sales/ }));
    await userEvent.click(screen.getByRole("button", { name: "OK" }));
    await userEvent.keyboard("{ArrowUp}");
    expect(screen.getByText(/Your role/)).toBeInTheDocument();
  });
});
