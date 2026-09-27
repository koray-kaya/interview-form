import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LinkMaker } from "@/components/LinkMaker";

describe("LinkMaker", () => {
  it("turns a company number into a German and an English link", async () => {
    render(<LinkMaker />);
    await userEvent.type(screen.getByLabelText(/Company number/), "CHE-123.456.788");
    await userEvent.click(screen.getByRole("button", { name: "Create links" }));
    expect(screen.getByText(/\?c=CHE-123\.456\.788&l=de$/)).toBeInTheDocument();
    expect(screen.getByText(/\?c=CHE-123\.456\.788&l=en$/)).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("warns when the check digit is wrong, and still gives the links", async () => {
    render(<LinkMaker />);
    await userEvent.type(screen.getByLabelText(/Company number/), "CHE-123.456.789");
    await userEvent.click(screen.getByRole("button", { name: "Create links" }));
    expect(screen.getByRole("alert")).toHaveTextContent(/check digit/);
    expect(screen.getByText(/\?c=CHE-123\.456\.789&l=de$/)).toBeInTheDocument();
  });

  it("says personal links are made in company-reach, and offers no button for them", () => {
    render(<LinkMaker />);
    expect(screen.getByText(/made in company-reach/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Personal link" })).not.toBeInTheDocument();
  });

  it("offers to copy each link", async () => {
    render(<LinkMaker />);
    await userEvent.type(screen.getByLabelText(/Company number/), "CHE-123.456.788");
    await userEvent.click(screen.getByRole("button", { name: "Create links" }));
    expect(screen.getAllByRole("button", { name: /Copy/ })).toHaveLength(2);
  });
});
