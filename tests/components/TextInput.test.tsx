import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TextInput } from "@/components/TextInput";

// jsdom has no matchMedia; a test that needs a touch screen defines it.
function touchScreen() {
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: query === "(pointer: coarse)" }));
}
afterEach(() => vi.unstubAllGlobals());

describe("TextInput", () => {
  it("reports typing", async () => {
    const onChange = vi.fn();
    render(<TextInput value="" maxChars={4000} lang="en" onChange={onChange} onSubmit={() => {}} />);
    await userEvent.type(screen.getByRole("textbox"), "hi");
    expect(onChange).toHaveBeenCalled();
  });

  it("Enter submits, Shift+Enter does not", async () => {
    const onSubmit = vi.fn();
    render(<TextInput value="x" maxChars={4000} lang="en" onChange={() => {}} onSubmit={onSubmit} />);
    const box = screen.getByRole("textbox");
    await userEvent.type(box, "{Shift>}{Enter}{/Shift}");
    expect(onSubmit).not.toHaveBeenCalled();
    await userEvent.type(box, "{Enter}");
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("shows the line-break hint in the chosen language", () => {
    render(<TextInput value="" maxChars={4000} lang="de" onChange={() => {}} onSubmit={() => {}} />);
    expect(screen.getByText(/Zeilenumbruch/)).toBeInTheDocument();
  });

  it("does not submit while a character is being composed", () => {
    const onSubmit = vi.fn();
    render(<TextInput value="x" maxChars={4000} lang="en" onChange={() => {}} onSubmit={onSubmit} />);
    fireEvent.keyDown(screen.getByRole("textbox"), { key: "Enter", isComposing: true });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("on a touch screen Enter makes a line break and the hint is hidden", async () => {
    touchScreen();
    const onSubmit = vi.fn();
    render(<TextInput value="x" maxChars={4000} lang="de" onChange={() => {}} onSubmit={onSubmit} />);
    await userEvent.type(screen.getByRole("textbox"), "{Enter}");
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.queryByText(/Zeilenumbruch/)).not.toBeInTheDocument();
  });
});
