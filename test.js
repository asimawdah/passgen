import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const cliPath = join(__dirname, "index.js");

function runPassgen(args = []) {
  return spawnSync(process.execPath, [cliPath, ...args], {
    encoding: "utf8",
  });
}

function assertPasswordLength(run, length, label) {
  assert.equal(run.status, 0, run.stderr);
  assert.equal(run.stdout.trim().length, length, label);
}

function assertReportSchema(report, expectedLength) {
  assert.equal(report.schema_version, 2, "JSON reports should expose a stable schema version");
  assert.match(report.generated_at, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/, "generated_at should be ISO-8601 UTC");
  assert.equal(report.length, expectedLength);
  assert.equal(typeof report.entropy_bits, "number");
  assert.ok(["Weak", "Medium", "Strong", "Ultra"].includes(report.strength));
  assert.ok(Array.isArray(report.enabled_sets));
  assert.ok(Array.isArray(report.enabled_set_labels));
  assert.ok(Array.isArray(report.warnings));
  assert.ok(Array.isArray(report.recommendations));
  assert.equal(report.coverage, "guaranteed");
  assert.equal(typeof report.redacted, "boolean");
  assert.equal(typeof report.password_present, "boolean");
}

const defaultRun = runPassgen();
assertPasswordLength(defaultRun, 12, "default password should be 12 characters long");

const customLengthRun = runPassgen(["--length", "20", "--symbols", "false"]);
assertPasswordLength(customLengthRun, 20, "custom length should be respected");
assert.doesNotMatch(customLengthRun.stdout.trim(), /[!@#$%^&*()\-_=+\[\]{}<>?/|]/, "symbols should be excluded when disabled");

const noSymbolsRun = runPassgen(["--length", "20", "--no-symbols"]);
assertPasswordLength(noSymbolsRun, 20, "negated boolean flags should be supported");
assert.doesNotMatch(noSymbolsRun.stdout.trim(), /[!@#$%^&*()\-_=+\[\]{}<>?/|]/, "--no-symbols should exclude symbols");

assertPasswordLength(runPassgen(["ultra"]), 32, "ultra positional preset should generate 32 characters");
assertPasswordLength(runPassgen(["ULTRA"]), 32, "uppercase positional presets should normalize");
assertPasswordLength(runPassgen(["--mode", " strong "]), 18, "padded --mode values should normalize");

const lowerOnlyRun = runPassgen(["--upper", "false", "--numbers", "false", "--symbols", "false"]);
assert.equal(lowerOnlyRun.status, 0, lowerOnlyRun.stderr);
assert.match(lowerOnlyRun.stdout.trim(), /^[a-z]+$/, "lower-only options should restrict the character set");

const allSetsMinimumRun = runPassgen(["--length", "4"]);
assert.equal(allSetsMinimumRun.status, 0, allSetsMinimumRun.stderr);
assert.match(allSetsMinimumRun.stdout.trim(), /[a-z]/, "enabled lowercase set should be represented");
assert.match(allSetsMinimumRun.stdout.trim(), /[A-Z]/, "enabled uppercase set should be represented");
assert.match(allSetsMinimumRun.stdout.trim(), /[0-9]/, "enabled numbers set should be represented");
assert.match(allSetsMinimumRun.stdout.trim(), /[!@#$%^&*()\-_=+\[\]{}<>?/|]/, "enabled symbols set should be represented");

const invalidLengthRun = runPassgen(["--length", "0"]);
assert.notEqual(invalidLengthRun.status, 0, "zero length should fail");
assert.match(invalidLengthRun.stderr, /Password length must be an integer/);
assert.match(invalidLengthRun.stderr, /Hint: Use `--length 20`/);
assert.equal(invalidLengthRun.stdout, "", "invalid length should not print a password");

const decimalLengthRun = runPassgen(["--length", "3.5"]);
assert.notEqual(decimalLengthRun.status, 0, "decimal length should fail");
assert.match(decimalLengthRun.stderr, /Password length must be an integer/);

const missingLengthValueRun = runPassgen(["--length"]);
assert.notEqual(missingLengthValueRun.status, 0, "missing length value should fail");
assert.match(missingLengthValueRun.stderr, /Not enough arguments following: length/);
assert.match(missingLengthValueRun.stderr, /Hint: Provide a numeric length/);
assert.equal(missingLengthValueRun.stdout, "", "missing option values should not print a password");

const missingModeValueRun = runPassgen(["--mode"]);
assert.notEqual(missingModeValueRun.status, 0, "missing mode value should fail");
assert.match(missingModeValueRun.stderr, /Hint: Provide a preset for --mode/);
assert.equal(missingModeValueRun.stdout, "", "missing mode values should not print a password");

const tooShortForSetsRun = runPassgen(["--length", "3"]);
assert.notEqual(tooShortForSetsRun.status, 0, "length shorter than enabled character sets should fail");
assert.match(tooShortForSetsRun.stderr, /too short for 4 enabled character sets/);
assert.match(tooShortForSetsRun.stderr, /lowercase, uppercase, numbers, symbols/);
assert.equal(tooShortForSetsRun.stdout, "", "coverage validation errors should not print a password");

for (const args of [["--mode", "maximum"], ["maximum"], ["--mode", "streng"]]) {
  const run = runPassgen(args);
  assert.notEqual(run.status, 0, `invalid mode should fail for ${args.join(" ")}`);
  assert.match(run.stderr, /Unknown mode/);
  assert.equal(run.stdout, "", "mode validation errors should not print a password");
}

const typoedModeRun = runPassgen(["--mode", "streng"]);
assert.match(typoedModeRun.stderr, /Hint: Did you mean "strong"\?/);

const extraPositionalRun = runPassgen(["strong", "extra"]);
assert.notEqual(extraPositionalRun.status, 0, "extra positional arguments should fail");
assert.match(extraPositionalRun.stderr, /Unexpected positional arguments: extra/);
assert.equal(extraPositionalRun.stdout, "", "extra positional validation errors should not print a password");

const mixedModeRun = runPassgen(["--mode", "strong", "ultra"]);
assert.notEqual(mixedModeRun.status, 0, "mixing --mode with a positional preset should fail");
assert.match(mixedModeRun.stderr, /Use either a positional preset or --mode/);
assert.equal(mixedModeRun.stdout, "", "ambiguous mode validation errors should not print a password");

for (const args of [["--lenght", "20"], ["-lenght", "20"], ["--password-size", "20"], ["--no-symbl", "20"]]) {
  const run = runPassgen(args);
  assert.notEqual(run.status, 0, `unknown option should fail for ${args.join(" ")}`);
  assert.match(run.stderr, /Unknown argument/);
  assert.equal(run.stdout, "", "unknown option validation should not print a password");
}

const noCharsetRun = runPassgen(["--upper", "false", "--lower", "false", "--numbers", "false", "--symbols", "false"]);
assert.notEqual(noCharsetRun.status, 0, "disabling every character set should fail");
assert.match(noCharsetRun.stderr, /No character sets enabled/);
assert.equal(noCharsetRun.stdout, "", "empty charset validation should not print a password");

const infoRun = runPassgen(["--length", "16", "--info"]);
assertPasswordLength(infoRun, 16, "--info should still print only the generated password to stdout");
assert.match(infoRun.stderr, /Password Info/);
assert.match(infoRun.stderr, /Mode:\s+custom/);
assert.match(infoRun.stderr, /Coverage:\s+guaranteed/);
assert.match(infoRun.stderr, /Strength:/);

const reportRun = runPassgen(["strong", "--report"]);
assertPasswordLength(reportRun, 18, "--report should keep stdout script-friendly");
assert.match(reportRun.stderr, /Password Strength Report/);
assert.match(reportRun.stderr, /Entropy:/);
assert.match(reportRun.stderr, /Recommendations:/);

const jsonRun = runPassgen(["--length", "16", "--format", "json"]);
assert.equal(jsonRun.status, 0, jsonRun.stderr);
const jsonReport = JSON.parse(jsonRun.stdout);
assert.equal(jsonReport.password.length, 16, "JSON output should include the generated value");
assertReportSchema(jsonReport, 16);
assert.equal(jsonReport.redacted, false);
assert.equal(jsonReport.password_present, true);

const redactedJsonRun = runPassgen(["--length", "16", "--format", "json", "--redact"]);
assert.equal(redactedJsonRun.status, 0, redactedJsonRun.stderr);
const redactedJsonReport = JSON.parse(redactedJsonRun.stdout);
assert.equal(redactedJsonReport.password, "[redacted]", "--redact should remove the generated value from JSON output");
assertReportSchema(redactedJsonReport, 16);
assert.equal(redactedJsonReport.redacted, true);
assert.equal(redactedJsonReport.password_present, false);

const redactTextRun = runPassgen(["--redact"]);
assert.notEqual(redactTextRun.status, 0, "--redact should not silently pass through text output");
assert.match(redactTextRun.stderr, /--redact requires --format json/);
assert.equal(redactTextRun.stdout, "");

const quietWithoutOutputRun = runPassgen(["--quiet"]);
assert.notEqual(quietWithoutOutputRun.status, 0, "--quiet without --output should fail instead of discarding a password");
assert.match(quietWithoutOutputRun.stderr, /--quiet requires --output/);
assert.equal(quietWithoutOutputRun.stdout, "");

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
  assertReportSchema(exportedReport, 32);
  assert.equal(exportedReport.password_present, true);

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

const helpRun = runPassgen(["--help"]);
assert.equal(helpRun.status, 0, helpRun.stderr);
assert.match(helpRun.stdout, /Usage: passgen \[preset\] \[options\]/);
assert.match(helpRun.stdout, /Examples:/);
assert.match(helpRun.stdout, /Safe defaults:/);
assert.match(helpRun.stdout, /--report/);
assert.match(helpRun.stdout, /--format/);
assert.match(helpRun.stdout, /Generated passwords are printed to stdout/);
assert.match(helpRun.stdout, /Treat generated values as secrets/);
assert.equal(helpRun.stderr, "", "help output should stay on stdout for CLI discoverability");

console.log("passgen CLI smoke tests passed");
