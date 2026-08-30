import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const doc = (name: string) => readFileSync(new URL(`../docs/${name}`, import.meta.url), "utf8");

test("keeps product, current architecture, RFCs, and delivery evidence distinct", () => {
  assert.match(doc("product.md"), /defines the product independent of release state/u);
  assert.match(doc("architecture.md"), /describes only implemented repository behavior/u);
  assert.match(doc("rfcs/README.md"), /Acceptance never means implementation or deployment/u);
  assert.match(doc("project-status.md"), /Do not infer completion/u);
});

test("documents canonical Markdown as the web documentation source", () => {
  assert.match(doc("README.md"), /Markdown files remain the source of truth/u);
  assert.match(doc("user-guide.md"), /do not maintain a second copy/u);
});
