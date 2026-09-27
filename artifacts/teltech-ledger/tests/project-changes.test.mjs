import test from "node:test";
import assert from "node:assert/strict";
import { getProjectChanges } from "../src/lib/project-changes.ts";

test("renaming an existing project does not send an unchanged nullable icon or columns", () => {
  const original = { name: "Teltech", color: "#7C5AC2", icon: null };
  const edited = { ...original, name: "Teltech Operação" };

  assert.deepEqual(getProjectChanges(original, edited), { name: "Teltech Operação" });
});

test("removing an icon is explicit while unchanged fields are omitted", () => {
  const original = { name: "Teltech", color: "#7C5AC2", icon: "data:image/png;base64,abc" };

  assert.deepEqual(getProjectChanges(original, { ...original, icon: null }), { icon: null });
  assert.deepEqual(getProjectChanges(original, original), {});
});

test("project names are trimmed before being sent", () => {
  const original = { name: "Teltech", color: "#7C5AC2", icon: null };

  assert.deepEqual(getProjectChanges(original, { ...original, name: "  Operação  " }), { name: "Operação" });
});
