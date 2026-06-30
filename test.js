import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const cliPath = join(__dirname, "index.js");

function runPassgen(args = []) {
  return spawnSync(process.execPath, [cliPath, ...args], {
    encoding: "utf8",
  });
}

const defaultRun = runPassgen();
assert.equal(defaultRun.status, 0, defaultRun.stderr);
assert.equal(defaultRun.stdout.trim().length, 12, "default output should be 12 characters long");

const customLengthRun = runPassgen(["--length", "20", "--symbols", "false"]);
assert.equal(customLengthRun.status, 0, customLengthRun.stderr);
assert.equal(customLengthRun.stdout.trim().length, 20, "custom length should be respected");
assert.doesNotMatch(customLengthRun.stdout.trim(), /[!@#$%^&*()\-_=+\[\]{}<>?/|]/, "symbols should be excluded when disabled");

const ultraRun = runPassgen(["ultra"]);
assert.equal(ultraRun.status, 0, ultraRun.stderr);
assert.equal(ultraRun.stdout.trim().length, 32, "ultra positional preset should generate 32 characters");

const lowerOnlyRun = runPassgen(["--upper", "false", "--numbers", "false", "--symbols", "false"]);
assert.equal(lowerOnlyRun.status, 0, lowerOnlyRun.stderr);
assert.match(lowerOnlyRun.stdout.trim(), /^[a-z]+$/, "lower-only options should restrict the character set");

const invalidLengthRun = runPassgen(["--length", "0"]);
assert.notEqual(invalidLengthRun.status, 0, "zero length should fail");
assert.match(invalidLengthRun.stderr, /Password length must be an integer/);

const decimalLengthRun = runPassgen(["--length", "3.5"]);
assert.notEqual(decimalLengthRun.status, 0, "decimal length should fail");
assert.match(decimalLengthRun.stderr, /Password length must be an integer/);

const unknownFlagModeRun = runPassgen(["--mode", "maximum"]);
assert.notEqual(unknownFlagModeRun.status, 0, "unknown --mode value should fail");
assert.match(unknownFlagModeRun.stderr, /Unknown mode/);

const unknownPositionalModeRun = runPassgen(["maximum"]);
assert.notEqual(unknownPositionalModeRun.status, 0, "unknown positional mode should fail");
assert.match(unknownPositionalModeRun.stderr, /Unknown mode/);

const noCharsetRun = runPassgen(["--upper", "false", "--lower", "false", "--numbers", "false", "--symbols", "false"]);
assert.notEqual(noCharsetRun.status, 0, "disabling every character set should fail");
assert.match(noCharsetRun.stderr, /No character sets enabled/);

const quietWithoutOutputRun = runPassgen(["--quiet"]);
assert.notEqual(quietWithoutOutputRun.status, 0, "--quiet without --output should fail instead of discarding a password");
assert.match(quietWithoutOutputRun.stderr, /--quiet requires --output/);

const reportRun = runPassgen(["strong", "--report"]);
assert.equal(reportRun.status, 0, reportRun.stderr);
assert.equal(reportRun.stdout.trim().length, 18, "--report should keep stdout script-friendly");
assert.match(reportRun.stderr, /Password Strength Report/);
assert.match(reportRun.stderr, /Entropy:/);
assert.match(reportRun.stderr, /Strength:/);

const jsonRun = runPassgen(["--length", "16", "--format", "json"]);
assert.equal(jsonRun.status, 0, jsonRun.stderr);
const jsonReport = JSON.parse(jsonRun.stdout);
assert.equal(jsonReport.password.length, 16, "JSON output should include the generated value");
assert.equal(jsonReport.length, 16);
assert.equal(typeof jsonReport.entropy_bits, "number");
assert.ok(["Weak", "Medium", "Strong", "Ultra"].includes(jsonReport.strength));
assert.ok(Array.isArray(jsonReport.enabled_sets));
assert.ok(Array.isArray(jsonReport.warnings));

const redactedJsonRun = runPassgen(["--length", "16", "--format", "json", "--redact"]);
assert.equal(redactedJsonRun.status, 0, redactedJsonRun.stderr);
const redactedJsonReport = JSON.parse(redactedJsonRun.stdout);
assert.equal(redactedJsonReport.password, "[redacted]", "--redact should remove the generated value from JSON output");
assert.equal(redactedJsonReport.redacted, true);
assert.equal(redactedJsonReport.length, 16);
assert.equal(typeof redactedJsonReport.entropy_bits, "number");

const tempDir = mkdtempSync(join(tmpdir(), "passgen-test-"));
try {
  const textPath = join(tempDir, "value.txt");
  const exportRun = runPassgen(["--length", "15", "--output", textPath]);
  assert.equal(exportRun.status, 0, exportRun.stderr);
  assert.equal(exportRun.stdout.trim().length, 15);
  assert.equal(readFileSync(textPath, "utf8").trim().length, 15, "text export should write the generated value");

  const noOverwriteRun = runPassgen(["--output", textPath]);
  assert.notEqual(noOverwriteRun.status, 0, "existing output file should not be overwritten by default");
  assert.match(noOverwriteRun.stderr, /already exists/);

  const quietTextPath = join(tempDir, "quiet-value.txt");
  const quietExportRun = runPassgen(["--length", "15", "--output", quietTextPath, "--quiet"]);
  assert.equal(quietExportRun.status, 0, quietExportRun.stderr);
  assert.equal(quietExportRun.stdout, "", "--quiet should suppress stdout when exporting to a file");
  assert.equal(readFileSync(quietTextPath, "utf8").trim().length, 15, "quiet text export should still write the generated value");

  const jsonPath = join(tempDir, "report.json");
  const jsonExportRun = runPassgen(["ultra", "--format", "json", "--output", jsonPath]);
  assert.equal(jsonExportRun.status, 0, jsonExportRun.stderr);
  const exportedReport = JSON.parse(readFileSync(jsonPath, "utf8"));
  assert.equal(exportedReport.preset, "ultra");
  assert.equal(exportedReport.length, 32);

  const quietJsonPath = join(tempDir, "quiet-report.json");
  const quietJsonExportRun = runPassgen(["ultra", "--format", "json", "--output", quietJsonPath, "--quiet"]);
  assert.equal(quietJsonExportRun.status, 0, quietJsonExportRun.stderr);
  assert.equal(quietJsonExportRun.stdout, "", "--quiet should suppress JSON stdout when exporting to a file");
  const quietJsonReport = JSON.parse(readFileSync(quietJsonPath, "utf8"));
  assert.equal(quietJsonReport.preset, "ultra");
  assert.equal(quietJsonReport.length, 32);

  const redactedJsonPath = join(tempDir, "redacted-report.json");
  const redactedJsonExportRun = runPassgen(["ultra", "--format", "json", "--redact", "--output", redactedJsonPath]);
  assert.equal(redactedJsonExportRun.status, 0, redactedJsonExportRun.stderr);
  const exportedRedactedReport = JSON.parse(readFileSync(redactedJsonPath, "utf8"));
  assert.equal(exportedRedactedReport.password, "[redacted]");
  assert.equal(exportedRedactedReport.redacted, true);
  assert.equal(exportedRedactedReport.length, 32);
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}

console.log("passgen CLI smoke tests passed");
