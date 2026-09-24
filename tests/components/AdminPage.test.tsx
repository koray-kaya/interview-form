import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/server", () => ({ connection: vi.fn(async () => {}) }));
vi.mock("@/db", () => ({
  readStats: vi.fn(async () => ({
    responses: [
      { company_uid: "CHE-123.456.788", lang: "de", form_version: "2.0.0", created_at: "2026-10-10T08:00:00Z", completed_at: "2026-10-10T08:12:00Z" },
      { company_uid: null, lang: "en", form_version: "2.0.0", created_at: "2026-10-10T09:00:00Z", completed_at: null },
    ],
    calls: [{ decision: "ask" }, { decision: "stop" }],
  })),
}));
import AdminPage from "@/app/admin/page";

describe("the admin page", () => {
  it("shows the counts and the link maker", async () => {
    render(await AdminPage());
    expect(screen.getByRole("heading", { name: /Survey/ })).toBeInTheDocument();
    expect(screen.getByText("Completed").nextSibling).toHaveTextContent("1");
    expect(screen.getByText("In progress").nextSibling).toHaveTextContent("1");
    expect(screen.getByText(/2 model calls/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create links" })).toBeInTheDocument();
  });

  it("shows no answer text or company number", async () => {
    const { container } = render(await AdminPage());
    expect(container.textContent).not.toContain("CHE-123.456.788");
  });
});
