import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const componentsSource = await readFile(
  new URL("../apps/web/components/stack-components.tsx", import.meta.url),
  "utf8",
);
const managementSource = await readFile(
  new URL("../apps/web/components/stack-management.tsx", import.meta.url),
  "utf8",
);

test("keeps component exploration non-modal and selection shared across views", () => {
  assert.doesNotMatch(componentsSource, /<Sheet|SheetContent/u);
  assert.match(componentsSource, /selectedId=\{selected\?\.id/u);
  assert.match(componentsSource, /CompactComponentSummary/u);
  assert.match(componentsSource, /2xl:grid-cols-\[minmax\(0,1fr\)_23rem\]/u);
});

test("gives component editing a dedicated sectioned workspace", () => {
  for (const section of ["overview", "capabilities", "relationships", "guidance"]) {
    assert.match(managementSource, new RegExp(`value="${section}"`, "u"));
  }
  assert.match(managementSource, /Back to Components/u);
});
