// Registers the jest-dom matchers (toBeInTheDocument, toBeChecked, ...) and
// unmounts whatever a test rendered, so the next test starts on an empty page.
// (Testing Library cleans up by itself only when Vitest globals are on.)
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(() => cleanup());
