# Response Tags for company-reach Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

Issue #24. Branch `feat/24-tags-endpoint`, cut from `main`.

**Goal:** company-reach can ask the survey which links were started or completed, and personal codes are made there, where the person they went to is recorded.

**Architecture:** A new admin route `GET /api/admin/tags` returns each tagged response's tag with its start and completion time, nothing else. It sits behind the admin password twice: the Proxy's matcher and a check in the route. A pure function `toTags` does the filtering, so it is tested without the database. The admin page stops making personal codes and says where they are made now.

**Tech Stack:** Next.js 16 route handler, supabase-js (through `src/db.ts` only), Vitest.

**Spec:** issue #24; decision of 2026-09-27: company-reach keeps the code-to-person mapping, the survey stores no names (`docs/design/2026-09-21-interview-form-design.md` §7). Companion plan: `company-reach/docs/plans/2026-09-27-68-contact-log.md`.

## Global Constraints

- Contract with company-reach: `GET /api/admin/tags`, HTTP Basic auth with `ADMIN_PASSWORD` (any user name), `200 {"tags": [{"tag": string, "started_at": string, "completed_at": string | null}]}`; `401 {"error": "unauthorized"}` otherwise (in practice the Proxy's plain-text 401 comes first; company-reach reads only the status).
- No answer text, no reference code, no language, no other column leaves through this route.
- Untagged responses and the smoke test's (`SMOKE_TAG`) are left out.
- The repository is public: fictional codes and UIDs in tests.
- `src/db.ts` is the only module that talks to Supabase; routes' tests mock it.
- Test first; `npm test`, `npm run lint`, `npx tsc --noEmit`, `npm run build` must pass.

## Review Focus

1. **A request without the password, or with a wrong one, reaching the route directly** (a future matcher edit). The route refuses by itself and reads nothing. Pinned in Task 1.
2. **`ADMIN_PASSWORD` unset or shorter than 12 characters.** The route stays shut, like the page (`src/admin-auth.ts`). Pinned in Task 1.
3. **A response started but not finished.** It appears with `completed_at: null`, so company-reach can show "started". Pinned in Task 1 (`toTags`).

---

### Task 1: `GET /api/admin/tags`

**Files:**
- Create: `src/tags.ts`
- Modify: `src/db.ts` (one function after `readStats`)
- Create: `src/app/api/admin/tags/route.ts`
- Test: `tests/tags.test.ts`, `tests/api/tags.test.ts`

**Interfaces:**
- Produces: `type TagSource = { company_uid: string | null; created_at: string; completed_at: string | null }`, `type Tag = { tag: string; started_at: string; completed_at: string | null }`, `toTags(rows: TagSource[]): Tag[]`, `readTagSources(): Promise<TagSource[]>`, `GET(request: Request): Promise<Response>`.

- [ ] **Step 1: Write the failing tests**

`tests/tags.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { toTags } from "@/tags";

describe("toTags", () => {
  it("gives each tagged response's tag and times, and nothing else", () => {
    expect(
      toTags([
        { company_uid: "P-7K3Q9X", created_at: "2026-10-03T10:00:00+00:00", completed_at: null },
        { company_uid: "CHE000000046", created_at: "2026-10-02T09:00:00+00:00", completed_at: "2026-10-02T09:12:00+00:00" },
      ]),
    ).toEqual([
      { tag: "P-7K3Q9X", started_at: "2026-10-03T10:00:00+00:00", completed_at: null },
      { tag: "CHE000000046", started_at: "2026-10-02T09:00:00+00:00", completed_at: "2026-10-02T09:12:00+00:00" },
    ]);
  });

  it("leaves out untagged responses and the smoke test's", () => {
    expect(
      toTags([
        { company_uid: null, created_at: "2026-10-03T10:00:00+00:00", completed_at: null },
        { company_uid: "", created_at: "2026-10-03T10:00:00+00:00", completed_at: null },
        { company_uid: "SMOKE", created_at: "2026-10-03T10:00:00+00:00", completed_at: null },
      ]),
    ).toEqual([]);
  });
});
```

`tests/api/tags.test.ts`:

```ts
// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The database is mocked: these tests check what the route lets out, not Supabase.
vi.mock("@/db", () => ({
  readTagSources: vi.fn(async () => [
    { company_uid: "P-7K3Q9X", created_at: "2026-10-03T10:00:00+00:00", completed_at: null },
    { company_uid: "SMOKE", created_at: "2026-10-03T10:00:00+00:00", completed_at: null },
  ]),
}));
import * as db from "@/db";
import { GET } from "@/app/api/admin/tags/route";

const PASSWORD = "correct horse battery staple";
const basic = (password: string) => `Basic ${Buffer.from(`company-reach:${password}`).toString("base64")}`;

function get(authorization?: string) {
  return GET(
    new Request("http://localhost/api/admin/tags", {
      headers: authorization ? { authorization } : {},
    }),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("ADMIN_PASSWORD", PASSWORD);
});
afterEach(() => vi.unstubAllEnvs());

describe("GET /api/admin/tags", () => {
  it("gives the admin each tag with its times", async () => {
    const response = await get(basic(PASSWORD));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      tags: [{ tag: "P-7K3Q9X", started_at: "2026-10-03T10:00:00+00:00", completed_at: null }],
    });
  });

  it("refuses without the right password, and reads nothing", async () => {
    for (const authorization of [undefined, basic("wrong password here")]) {
      expect((await get(authorization)).status).toBe(401);
    }
    expect(db.readTagSources).not.toHaveBeenCalled();
  });

  it("stays shut while no password of twelve characters is set", async () => {
    vi.stubEnv("ADMIN_PASSWORD", "short");
    expect((await get(basic("short"))).status).toBe(401);
    expect(db.readTagSources).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `npx vitest run tests/tags.test.ts tests/api/tags.test.ts`
Expected: FAIL, cannot resolve `@/tags` and `@/app/api/admin/tags/route`.

- [ ] **Step 3: Write the code**

`src/tags.ts`:

```ts
// The response tags company-reach fetches (GET /api/admin/tags): which link
// each response came through, and when it started and ended. company-reach
// keeps who each code went to; this app never learns it (design §7).
// Untagged and smoke-test responses name no invitation, so they are left out.
import { SMOKE_TAG } from "@/responses";

export type TagSource = { company_uid: string | null; created_at: string; completed_at: string | null };
export type Tag = { tag: string; started_at: string; completed_at: string | null };

export function toTags(rows: TagSource[]): Tag[] {
  return rows
    .filter((row): row is TagSource & { company_uid: string } => Boolean(row.company_uid) && row.company_uid !== SMOKE_TAG)
    .map((row) => ({ tag: row.company_uid, started_at: row.created_at, completed_at: row.completed_at }));
}
```

In `src/db.ts`, import the type (`import type { TagSource } from "@/tags";`) and add after `readStats`:

```ts
/** The three columns toTags needs, for company-reach; no answers. */
export async function readTagSources(): Promise<TagSource[]> {
  return must(
    await db().from("responses").select("company_uid, created_at, completed_at").order("created_at"),
    "readTagSources",
  ) as TagSource[];
}
```

`src/app/api/admin/tags/route.ts`:

```ts
// GET /api/admin/tags — for company-reach, the owner's local recruiting tool
// (#24): each tagged response's tag with its start and completion time, so
// the tool can show who answered. No answers and no other field leave here.
// Behind the admin password twice: the Proxy asks for it on /api/admin/*, and
// this route checks it again, so an edit to the matcher cannot open it.
import { adminAuthorized } from "@/admin-auth";
import { readTagSources } from "@/db";
import { json } from "@/http";
import { toTags } from "@/tags";

export async function GET(request: Request): Promise<Response> {
  if (!adminAuthorized(request.headers.get("authorization"), process.env.ADMIN_PASSWORD)) {
    return json(401, { error: "unauthorized" });
  }
  return json(200, { tags: toTags(await readTagSources()) });
}
```

Check `src/http.ts` for `json`'s signature (`json(status, body)`, used the same way in `src/app/api/cron/daily/route.ts`) and `src/admin-auth.ts` for `adminAuthorized(header, password)`.

- [ ] **Step 4: Run the tests to see them pass**

Run: `npx vitest run tests/tags.test.ts tests/api/tags.test.ts tests/proxy.test.ts`
Expected: PASS (all)

- [ ] **Step 5: Commit**

```bash
git add src/tags.ts src/db.ts src/app/api/admin/tags/route.ts tests/tags.test.ts tests/api/tags.test.ts
git commit -m "feat: response tags for company-reach (#24)"
```

---

### Task 2: Personal codes move to company-reach

**Files:**
- Modify: `src/components/LinkMaker.tsx`
- Modify: `src/links.ts` (remove `personalCode`, `ALPHABET`, `cryptoRandom`)
- Modify: `tests/components/LinkMaker.test.tsx`, `tests/links.test.ts`
- Modify: `AGENTS.md:23-26`, `README.md:118-125`, `docs/design/2026-09-21-interview-form-design.md` (§7 after "What is not stored", and the admin bullet in the security list)

**Interfaces:**
- Consumes: nothing new.
- Produces: `LinkMaker` without the "Personal link" button; `links.ts` exports only `inviteLinks`.

- [ ] **Step 1: Change the tests first**

In `tests/components/LinkMaker.test.tsx`, replace the two tests that press "Personal link" with:

```tsx
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
```

In `tests/links.test.ts`, delete the `describe("personalCode", …)` block and remove `personalCode` from the import.

- [ ] **Step 2: Run the tests to see them fail**

Run: `npx vitest run tests/components/LinkMaker.test.tsx tests/links.test.ts`
Expected: FAIL on "made in company-reach".

- [ ] **Step 3: Change the component and the module**

`src/components/LinkMaker.tsx`:
- Header comment: "The admin page's link maker: a company number (UID) becomes a German and an English invitation link. The check digit is only a warning — every link gets the AI follow-ups — but a mistyped number would label the answers wrongly. Personal links for people are made in company-reach, which records who each one went to (#24); this app never learns a name. Runs in the browser; nothing is stored."
- `import { inviteLinks } from "@/links";` (drop `personalCode`).
- `type Made = { tag: string; warning: boolean };`, `setMade({ tag, warning: !isValidUid(tag) })`; delete `personal()` and the `made?.personal` paragraph.
- Delete the "Personal link" `<button>`; the "Create links" button stays alone in its `div`.
- Under the `<h2>`, add:

```tsx
      <p className="text-sm text-body">
        Personal links for people without a company number are made in company-reach, which records who each one went to.
      </p>
```

`src/links.ts`: delete `ALPHABET`, `cryptoRandom` and `personalCode`; the header comment becomes "Invitation links for the admin page: the form's address with the company tag (?c=) and the language (?l=). Personal codes (P-XXXXXX) are made in company-reach (#24). Plain functions, no library; used in the browser."

`src/stats.ts` keeps counting `P-` tags as personal links: the codes still arrive, they are only made elsewhere.

- [ ] **Step 4: Run the tests to see them pass**

Run: `npx vitest run tests/components tests/links.test.ts tests/stats.test.ts`
Expected: PASS (all)

- [ ] **Step 5: Update the documents**

- `AGENTS.md:23-26`: "or a personal code (`P-XXXXXX`) from the admin page" becomes "or a personal code (`P-XXXXXX`) made in company-reach, which records who it went to; this app never stores the name (2026-09-27, #24). `GET /api/admin/tags` hands company-reach each response's tag and times, nothing else."
- `README.md` procedure 6, step 2: "Paste a company number (UID) and press Create links; copy the German or English link. Links for people without a company number are made in company-reach, which records who gets each code." Add a step: "company-reach reads who started or completed through `/api/admin/tags`, with the same password."
- Design doc §7, after the paragraph beginning "What is not stored": "Who a personal code went to is kept in company-reach, on the owner's machine, never here (2026-09-27, #24). `GET /api/admin/tags`, behind the admin password, returns only each tagged response's tag, start and completion time, so company-reach can show who answered."
- Design doc, the admin-page bullet ("shows counts only — no answer text, no company number"): add "The one admin route, `/api/admin/tags`, returns tags and times for company-reach and nothing else."

- [ ] **Step 6: The whole suite**

Run: `npm run lint && npx tsc --noEmit && npm test && npm run build`
Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add src/components/LinkMaker.tsx src/links.ts tests AGENTS.md README.md docs/design/2026-09-21-interview-form-design.md
git commit -m "feat: personal codes are made in company-reach (#24)"
```

---

## After merge

- Vercel deploys `main`. Check once: `curl -s -u x:"$ADMIN_PASSWORD" https://<production>/api/admin/tags` answers `{"tags":[…]}`, and without `-u` answers 401.
- In company-reach's `.env`, `FORM_ADMIN_PASSWORD` = this app's `ADMIN_PASSWORD`.

## Self-review notes

- Spec coverage: the endpoint (Task 1), the admin page no longer makes codes (Task 2), the documents say where the mapping lives (Task 2 Step 5).
- The route adds no new data to anything already exported: `company_uid`, `created_at` and `completed_at` are in the CSV and the daily export.
