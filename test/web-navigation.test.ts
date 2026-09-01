import assert from "node:assert/strict";
import test from "node:test";
import { sectionFromView } from "../apps/web/lib/navigation.ts";

test("collapses legacy Overview, Graph, and Manage routes into Components", () => {
  assert.equal(sectionFromView("overview"), "components");
  assert.equal(sectionFromView("graph"), "components");
  assert.equal(sectionFromView("management"), "components");
  assert.equal(sectionFromView("components"), "components");
});

test("keeps independent admin destinations and defaults to documentation", () => {
  assert.equal(sectionFromView("activity"), "activity");
  assert.equal(sectionFromView("requests"), "requests");
  assert.equal(sectionFromView("integrations"), "integrations");
  assert.equal(sectionFromView("unknown"), "documentation");
  assert.equal(sectionFromView(null), "documentation");
});
