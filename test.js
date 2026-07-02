import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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

function assertReportSchema(report, expectedLength) {
  assert.equal(report.schema_version, 2, "JSON reports should expose a stable schema version");
  assert.equal(typeof report.generated_at, "string", "JSON reports should include generation timestamp metadata");
  assert.match(report.generated_at, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/, "generated_at should be an ISO-8601 UTC timestamp");
  assert.equal(report.length, expectedLength);
  assert.equal(typeof report.entropy_bits, "number");
  assert.ok(["Weak", "Medium", "Strong", "Ultra"].includes(report.strength));
  assert.ok(Array.isArray(report.enabled_sets));
  assert.ok(Array.isArray(report.warnings));
  assert.ok(Array.isArray(report.recommendations), "reports should include actionable recommendations");
  assert.ok(report.recommendations.length >= 1, "reports should always include at least one next-step recommendation");
  assert.equal(typeof report.redacted, "boolean", "JSON reports should make redaction state explicit");
  assert.equal(typeof report.password_present, "boolean", "JSON reports should say whether password contains a generated secret");
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

const redactTextRun = runPassgen(["--redact"]);
assert.notEqual(redactTextRun.status, 0, "--redact should not silently pass through plain text output");
assert.match(redactTextRun.stderr, /--redact requires --format json/);

const reportRun = runPassgen(["strong", "--report"]);
assert.equal(reportRun.status, 0, reportRun.stderr);
assert.equal(reportRun.stdout.trim().length, 18, "--report should keep stdout script-friendly");
assert.match(reportRun.stderr, /Password Strength Report/);
assert.match(reportRun.stderr, /Entropy:/);
assert.match(reportRun.stderr, /Strength:/);
assert.match(reportRun.stderr, /Recommendations:/);
assert.match(reportRun.stderr, /password manager|suitable for typical password-manager storage/);

const jsonRun = runPassgen(["--length", "16", "--format", "json"]);
assert.equal(jsonRun.status, 0, jsonRun.stderr);
const jsonReport = JSON.parse(jsonRun.stdout);
assert.equal(jsonReport.password.length, 16, "JSON output should include the generated value");
assertReportSchema(jsonReport, 16);
assert.equal(jsonReport.redacted, false);
assert.equal(jsonReport.password_present, true, "full JSON output should mark that the generated password is present");
assert.match(jsonReport.recommendations.join("\n"), /password manager|entropy|symbols/, "JSON recommendations should be practical and actionable");

const weakJsonRun = runPassgen(["weak", "--format", "json"]);
assert.equal(weakJsonRun.status, 0, weakJsonRun.stderr);
const weakJsonReport = JSON.parse(weakJsonRun.stdout);
assertReportSchema(weakJsonReport, 10);
assert.match(weakJsonReport.recommendations.join("\n"), /passgen strong/);
assert.match(weakJsonReport.recommendations.join("\n"), /symbols true/);

const redactedJsonRun = runPassgen(["--length", "16", "--format", "json", "--redact"]);
assert.equal(redactedJsonRun.status, 0, redactedJsonRun.stderr);
const redactedJsonReport = JSON.parse(redactedJsonRun.stdout);
assert.equal(redactedJsonReport.password, "[redacted]", "--redact should remove the generated value from JSON output");
assertReportSchema(redactedJsonReport, 16);
assert.equal(redactedJsonReport.redacted, true);
assert.equal(redactedJsonReport.password_present, false, "redacted JSON output should mark that no generated password is present");
assert.doesNotMatch(redactedJsonReport.recommendations.join("\n"), /generated password directly/, "redacted recommendations should not describe the placeholder as a generated secret");

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
  assertReportSchema(exportedReport, 32);
  assert.equal(exportedReport.redacted, false);
  assert.equal(exportedReport.password_present, true);

  const quietJsonPath = join(tempDir, "quiet-report.json");
  const quietJsonExportRun = runPassgen(["ultra", "--format", "json", "--output", quietJsonPath, "--quiet"]);
  assert.equal(quietJsonExportRun.status, 0, quietJsonExportRun.stderr);
  assert.equal(quietJsonExportRun.stdout, "", "--quiet should suppress JSON stdout when exporting to a file");
  const quietJsonReport = JSON.parse(readFileSync(quietJsonPath, "utf8"));
  assert.equal(quietJsonReport.preset, "ultra");
  assertReportSchema(quietJsonReport, 32);
  assert.equal(quietJsonReport.redacted, false);
  assert.equal(quietJsonReport.password_present, true);

  const redactedJsonPath = join(tempDir, "redacted-report.json");
  const redactedJsonExportRun = runPassgen(["ultra", "--format", "json", "--redact", "--output", redactedJsonPath]);
  assert.equal(redactedJsonExportRun.status, 0, redactedJsonExportRun.stderr);
  const exportedRedactedReport = JSON.parse(readFileSync(redactedJsonPath, "utf8"));
  assert.equal(exportedRedactedReport.password, "[redacted]");
  assertReportSchema(exportedRedactedReport, 32);
  assert.equal(exportedRedactedReport.redacted, true);
  assert.equal(exportedRedactedReport.password_present, false);

  const nestedPath = join(tempDir, "nested", "exports", "value.txt");
  const nestedExportRun = runPassgen(["--length", "15", "--output", nestedPath, "--quiet"]);
  assert.equal(nestedExportRun.status, 0, nestedExportRun.stderr);
  assert.equal(readFileSync(nestedPath, "utf8").trim().length, 15, "missing parent directories should be created safely");

  const badTextExtensionRun = runPassgen(["--output", join(tempDir, "value.json")]);
  assert.notEqual(badTextExtensionRun.status, 0, "text output should reject misleading JSON extension");
  assert.match(badTextExtensionRun.stderr, /text output must use .txt extension/);

  const badJsonExtensionRun = runPassgen(["--format", "json", "--output", join(tempDir, "report.txt")]);
  assert.notEqual(badJsonExtensionRun.status, 0, "JSON output should reject misleading text extension");
  assert.match(badJsonExtensionRun.stderr, /json output must use .json extension/);

  const directoryTarget = join(tempDir, "directory-target.txt");
  mkdirSync(directoryTarget);
  const directoryTargetRun = runPassgen(["--output", directoryTarget]);
  assert.notEqual(directoryTargetRun.status, 0, "directory output targets should fail before generation");
  assert.match(directoryTargetRun.stderr, /Output path is a directory/);

  const fileParent = join(tempDir, "file-parent");
  writeFileSync(fileParent, "not a directory");
  const fileParentRun = runPassgen(["--output", join(fileParent, "value.txt")]);
  assert.notEqual(fileParentRun.status, 0, "file parent output targets should fail before generation");
  assert.match(fileParentRun.stderr, /Output parent path is not a directory/);
  assert.equal(existsSync(join(fileParent, "value.txt")), false, "invalid parent path should not create a partial output file");
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}

console.log("passgen CLI smoke tests passed");
