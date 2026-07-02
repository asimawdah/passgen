import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const checklist = readFileSync(new URL("./docs/CLI_REVIEW_CHECKLIST.md", import.meta.url), "utf8");
const packageJson = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8"));

function assertIncludes(source, expected, label) {
  assert.ok(
    source.includes(expected),
    `${label} should include ${JSON.stringify(expected)} so CLI safety review guidance stays complete`,
  );
}

assertIncludes(checklist, "Generated passwords remain the only successful stdout output.", "CLI review checklist");
assertIncludes(checklist, "`--info` diagnostics, validation errors, and recovery hints stay on stderr.", "CLI review checklist");
assertIncludes(checklist, "Failed validation does not generate or print a password.", "CLI review checklist");
assertIncludes(checklist, "Requested length must be long enough to represent every enabled character set.", "CLI review checklist");
assertIncludes(checklist, "Unknown options fail loudly", "CLI review checklist");
assertIncludes(checklist, "Missing option values use option-specific hints", "CLI review checklist");
assertIncludes(checklist, "Extra positional arguments and mixed preset styles fail", "CLI review checklist");
assertIncludes(checklist, "not to paste generated passwords into logs", "CLI review checklist");
assertIncludes(checklist, "New CLI behavior should include a direct smoke test", "CLI review checklist");

assert.ok(
  packageJson.scripts.test.includes("test-cli-review-checklist.js"),
  "npm test should include the CLI review checklist guard",
);

console.log("passgen CLI review checklist checks passed");
