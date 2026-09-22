import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChoiceInput } from "@/components/ChoiceInput";

const options = [
  { id: "a", label: { de: "Eins", en: "One" } },
  { id: "b", label: { de: "Zwei", en: "Two" } },
  { id: "none", label: { de: "nichts", en: "none" } },
];

describe("ChoiceInput", () => {
  it("renders labels in the chosen language with key hints", () => {
    render(<ChoiceInput options={options} lang="de" multiple={false} selected={[]} onChange={() => {}} />);
    expect(screen.getByRole("radio", { name: /A\s*Eins/ })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /B\s*Zwei/ })).toBeInTheDocument();
  });

  it("single choice replaces the selection", async () => {
    const onChange = vi.fn();
    render(<ChoiceInput options={options} lang="en" multiple={false} selected={["a"]} onChange={onChange} />);
    await userEvent.click(screen.getByRole("radio", { name: /Two/ }));
    expect(onChange).toHaveBeenCalledWith(["b"]);
  });

  it("multi choice toggles and the exclusive option clears the rest", async () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <ChoiceInput options={options} lang="en" multiple exclusive="none" selected={["a"]} onChange={onChange} />,
    );
    await userEvent.click(screen.getByRole("checkbox", { name: /Two/ }));
    expect(onChange).toHaveBeenLastCalledWith(["a", "b"]);
    await userEvent.click(screen.getByRole("checkbox", { name: /none/ }));
    expect(onChange).toHaveBeenLastCalledWith(["none"]);
    rerender(<ChoiceInput options={options} lang="en" multiple exclusive="none" selected={["none"]} onChange={onChange} />);
    await userEvent.click(screen.getByRole("checkbox", { name: /One/ }));
    expect(onChange).toHaveBeenLastCalledWith(["a"]);
  });

  it("letter keys select", async () => {
    const onChange = vi.fn();
    render(<ChoiceInput options={options} lang="en" multiple={false} selected={[]} onChange={onChange} />);
    await userEvent.keyboard("b");
    expect(onChange).toHaveBeenCalledWith(["b"]);
  });

  it("ignores letter keys held with a modifier (Cmd+C copies, it does not choose C)", async () => {
    const onChange = vi.fn();
    render(<ChoiceInput options={options} lang="en" multiple={false} selected={[]} onChange={onChange} />);
    await userEvent.keyboard("{Meta>}b{/Meta}{Control>}b{/Control}{Alt>}b{/Alt}");
    expect(onChange).not.toHaveBeenCalled();
  });
});
