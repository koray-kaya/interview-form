import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FORM, type Question } from "@/form";
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

  it("gives a long question a little more width, a short one keeps its column", () => {
    const long = render(<QuestionScreen question={q("case")} lang="de" number={4} onSubmit={() => {}} />);
    expect(long.container.querySelector("section")).toHaveClass("max-w-3xl");
    long.unmount();
    const short = render(<QuestionScreen question={q("role")} lang="de" number={1} onSubmit={() => {}} />);
    expect(short.container.querySelector("section")).toHaveClass("max-w-2xl");
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

const often: Question = {
  id: "often",
  type: "rows",
  text: { de: "Wie oft?", en: "How often?" },
  rows: [
    { id: "buy", label: { de: "Eingekauft", en: "Bought" } },
    { id: "sell", label: { de: "Verkauft", en: "Sold" } },
  ],
  scale: [
    { id: "never", label: { de: "Nie", en: "Never" } },
    { id: "monthly", label: { de: "Monatlich", en: "Monthly" } },
  ],
};

describe("QuestionScreen with rows", () => {
  it("takes one point per row and wants every row before OK", async () => {
    const onSubmit = vi.fn();
    render(<QuestionScreen question={often} lang="en" number={10} onSubmit={onSubmit} />);
    const bought = screen.getByRole("radiogroup", { name: "Bought" });
    await userEvent.click(within(bought).getByRole("radio", { name: "Never" }));
    await userEvent.click(within(bought).getByRole("radio", { name: "Monthly" }));
    expect(within(bought).getByRole("radio", { name: "Monthly" })).toHaveAttribute("aria-checked", "true");
    expect(within(bought).getByRole("radio", { name: "Never" })).toHaveAttribute("aria-checked", "false");
    await userEvent.click(screen.getByRole("button", { name: "OK" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Please choose an answer in every row.");
    expect(onSubmit).not.toHaveBeenCalled();
    await userEvent.click(within(screen.getByRole("radiogroup", { name: "Sold" })).getByRole("radio", { name: "Never" }));
    await userEvent.click(screen.getByRole("button", { name: "OK" }));
    expect(onSubmit).toHaveBeenCalledWith({ rows: { buy: "monthly", sell: "never" } });
  });

  it("shows a saved answer again", () => {
    render(<QuestionScreen question={often} lang="de" number={10} initial={{ rows: { buy: "never", sell: "monthly" } }} onSubmit={() => {}} />);
    const sold = screen.getByRole("radiogroup", { name: "Verkauft" });
    expect(within(sold).getByRole("radio", { name: "Monatlich" })).toHaveAttribute("aria-checked", "true");
  });

  it("has no letter keys, and Enter submits", async () => {
    const onSubmit = vi.fn();
    render(<QuestionScreen question={often} lang="en" number={10} initial={{ rows: { buy: "never", sell: "never" } }} onSubmit={onSubmit} />);
    await userEvent.keyboard("b");
    expect(within(screen.getByRole("radiogroup", { name: "Bought" })).getByRole("radio", { name: "Never" })).toHaveAttribute("aria-checked", "true");
    await userEvent.keyboard("{Enter}");
    expect(onSubmit).toHaveBeenCalledWith({ rows: { buy: "never", sell: "never" } });
  });
});

const story: Question = {
  id: "story",
  type: "open",
  text: { de: "Erzählen Sie", en: "Tell us" },
  maxChars: 4000,
  escape: { id: "none", label: { de: "Ich erinnere mich an keinen solchen Fall.", en: "I can't think of such a case." } },
};

describe("QuestionScreen with an escape", () => {
  it("answers in one tap, whatever is in the box", async () => {
    const onSubmit = vi.fn();
    render(<QuestionScreen question={story} lang="en" number={4} onSubmit={onSubmit} />);
    await userEvent.type(screen.getByRole("textbox"), "half a thought");
    await userEvent.click(screen.getByRole("button", { name: "I can't think of such a case." }));
    expect(onSubmit).toHaveBeenCalledWith({ option: "none" });
  });

  it("after Back, shows an empty box and the escape marked", () => {
    render(<QuestionScreen question={story} lang="de" number={4} initial={{ option: "none" }} onSubmit={() => {}} />);
    expect(screen.getByRole("textbox")).toHaveValue("");
    expect(screen.getByRole("button", { name: /keinen solchen Fall/ })).toHaveAttribute("aria-pressed", "true");
  });

  it("shows a server error after the escape", async () => {
    render(<QuestionScreen question={story} lang="en" number={4} onSubmit={async () => "Your answer could not be saved."} />);
    await userEvent.click(screen.getByRole("button", { name: /such a case/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent("could not be saved");
  });

  it("is not offered while the model's follow-up is on screen, nor where the question has none", () => {
    const { unmount } = render(
      <QuestionScreen question={story} lang="en" number={4} onSubmit={() => {}} asking="Where did you look?" given={[{ answer: "We asked around." }]} />,
    );
    expect(screen.queryByRole("button", { name: /such a case/ })).not.toBeInTheDocument();
    unmount();
    render(<QuestionScreen question={q("pains")} lang="en" number={6} onSubmit={() => {}} />);
    expect(screen.queryByRole("button", { name: /such a case/ })).not.toBeInTheDocument();
  });
});
