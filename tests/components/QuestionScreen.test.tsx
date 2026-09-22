import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FORM } from "@/form";
import { QuestionScreen } from "@/components/QuestionScreen";

const q = (id: string) => FORM.questions.find((x) => x.id === id)!;

describe("QuestionScreen", () => {
  it("shows the number and the question in the chosen language", () => {
    render(<QuestionScreen question={q("size")} lang="de" number={2} onSubmit={() => {}} />);
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText(/Wie viele Personen/)).toBeInTheDocument();
  });

  it("refuses an empty choice and submits a chosen one", async () => {
    const onSubmit = vi.fn();
    render(<QuestionScreen question={q("role")} lang="en" number={1} onSubmit={onSubmit} />);
    await userEvent.click(screen.getByRole("button", { name: "OK" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Please choose an answer.");
    expect(onSubmit).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("radio", { name: /Sales/ }));
    await userEvent.click(screen.getByRole("button", { name: "OK" }));
    expect(onSubmit).toHaveBeenCalledWith({ option: "sales" });
  });

  it("submits open text on Enter", async () => {
    const onSubmit = vi.fn();
    render(<QuestionScreen question={q("case")} lang="en" number={4} onSubmit={onSubmit} />);
    await userEvent.type(screen.getByRole("textbox"), "I looked at their website.{Enter}");
    expect(onSubmit).toHaveBeenCalledWith({ text: "I looked at their website." });
  });

  it("asks for an e-mail only when contact is wanted", async () => {
    const onSubmit = vi.fn();
    render(<QuestionScreen question={q("followup")} lang="en" number={8} onSubmit={onSubmit} />);
    expect(screen.queryByLabelText(/e-mail/i)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("checkbox", { name: /conversation/ }));
    await userEvent.type(screen.getByLabelText(/e-mail/i), "a@b.ch");
    await userEvent.click(screen.getByRole("button", { name: "OK" }));
    expect(onSubmit).toHaveBeenCalledWith({ options: ["conversation"], email: "a@b.ch" });
  });

  it("starts from the initial value and offers Back", async () => {
    const onBack = vi.fn();
    render(<QuestionScreen question={q("case")} lang="en" number={4} initial={{ text: "earlier" }} onSubmit={() => {}} onBack={onBack} />);
    expect(screen.getByRole("textbox")).toHaveValue("earlier");
    await userEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(onBack).toHaveBeenCalled();
  });

  it("Enter submits a choice question too, even with an option focused", async () => {
    const onSubmit = vi.fn();
    render(<QuestionScreen question={q("role")} lang="en" number={1} onSubmit={onSubmit} />);
    await userEvent.click(screen.getByRole("radio", { name: /Sales/ })); // leaves focus on the option
    await userEvent.keyboard("{Enter}");
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith({ option: "sales" });
    expect(screen.getByRole("radio", { name: /Sales/ })).toHaveAttribute("aria-checked", "true");
  });
});
