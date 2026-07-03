import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const cliPath = join(__dirname, "index.js");
const SYMBOL_PATTERN = new RegExp("[!@#$%^&*()\\-_=+\\[\\]{}<>?/|]");

function runPassgen(args = []) {
  return spawnSync(process.execPath, [cliPath, ...args], {
    encoding: "utf8",
  });
}

function formatRun(run) {
  return [
    `status=${run.status}`,
    `stdout=${JSON.stringify(run.stdout)}`,
    `stderr=${JSON.stringify(run.stderr)}`,
    run.error ? `error=${run.error.message}` : null,
  ].filter(Boolean).join("\n");
}

function assertRunStatus(run, expectedStatus, label) {
  assert.equal(run.status, expectedStatus, `${label}\n${formatRun(run)}`);
}

function assertRunFailed(run, label) {
  assert.notEqual(run.status, 0, `${label}\n${formatRun(run)}`);
}

function assertPasswordLength(run, length, label) {
  assertRunStatus(run, 0, label);
  assert.equal(run.stdout.trim().length, length, `${label}\n${formatRun(run)}`);
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

const customLengthRun = runPassgen(["--length", "20", "--no-symbols"]);
assertPasswordLength(customLengthRun, 20, "custom length should be respected");
assert.doesNotMatch(customLengthRun.stdout.trim(), SYMBOL_PATTERN, `symbols should be excluded when disabled\n${formatRun(customLengthRun)}`);

const noSymbolsRun = runPassgen(["--length", "20", "--no-symbols"]);
assertPasswordLength(noSymbolsRun, 20, "negated boolean flags should be supported");
assert.doesNotMatch(noSymbolsRun.stdout.trim(), SYMBOL_PATTERN, `--no-symbols should exclude symbols\n${formatRun(noSymbolsRun)}`);

assertPasswordLength(runPassgen(["ultra"]), 32, "ultra positional preset should generate 32 characters");
assertPasswordLength(runPassgen(["ULTRA"]), 32, "uppercase positional presets should normalize");
assertPasswordLength(runPassgen(["--mode", " strong "]), 18, "padded --mode values should normalize");

const lowerOnlyRun = runPassgen(["--no-upper", "--no-numbers", "--no-symbols"]);
assertRunStatus(lowerOnlyRun, 0, "lower-only options should succeed");
assert.match(lowerOnlyRun.stdout.trim(), /^[a-z]+$/, `lower-only options should restrict the character set\n${formatRun(lowerOnlyRun)}`);

const allSetsMinimumRun = runPassgen(["--length", "4"]);
assertRunStatus(allSetsMinimumRun, 0, "all enabled sets should fit at the minimum length");
assert.match(allSetsMinimumRun.stdout.trim(), /[a-z]/, `enabled lowercase set should be represented\n${formatRun(allSetsMinimumRun)}`);
assert.match(allSetsMinimumRun.stdout.trim(), /[A-Z]/, `enabled uppercase set should be represented\n${formatRun(allSetsMinimumRun)}`);
assert.match(allSetsMinimumRun.stdout.trim(), /[0-9]/, `enabled numbers set should be represented\n${formatRun(allSetsMinimumRun)}`);
assert.match(allSetsMinimumRun.stdout.trim(), SYMBOL_PATTERN, `enabled symbols set should be represented\n${formatRun(allSetsMinimumRun)}`);

const invalidLengthRun = runPassgen(["--length", "0"]);
assertRunFailed(invalidLengthRun, "zero length should fail");
assert.match(invalidLengthRun.stderr, /Password length must be an integer/, formatRun(invalidLengthRun));
assert.match(invalidLengthRun.stderr, /Hint: Use `--length 20`/, formatRun(invalidLengthRun));
assert.equal(invalidLengthRun.stdout, "", "invalid length should not print a password");

const decimalLengthRun = runPassgen(["--length", "3.5"]);
assertRunFailed(decimalLengthRun, "decimal length should fail");
assert.match(decimalLengthRun.stderr, /Password length must be an integer/, formatRun(decimalLengthRun));

const tooShortForSetsRun = runPassgen(["--length", "3"]);
assertRunFailed(tooShortForSetsRun, "length shorter than enabled character sets should fail");
assert.match(tooShortForSetsRun.stderr, /too short for 4 enabled character sets/, formatRun(tooShortForSetsRun));
assert.match(tooShortForSetsRun.stderr, /lowercase, uppercase, numbers, symbols/, formatRun(tooShortForSetsRun));
assert.equal(tooShortForSetsRun.stdout, "", "coverage validation errors should not print a password");

for (const args of [["--mode", "maximum"], ["maximum"], ["--mode", "streng"]]) {
  const run = runPassgen(args);
  assertRunFailed(run, `invalid mode should fail for ${args.join(" ")}`);
  assert.match(run.stderr, /Unknown mode/, formatRun(run));
  assert.equal(run.stdout, "", "mode validation errors should not print a password");
}

const typoedModeRun = runPassgen(["--mode", "streng"]);
assert.match(typoedModeRun.stderr, /Hint: Did you mean "strong"\?/, formatRun(typoedModeRun));

const extraPositionalRun = runPassgen(["strong", "extra"]);
assertRunFailed(extraPositionalRun, "extra positional arguments should fail");
assert.match(extraPositionalRun.stderr, /Unexpected positional arguments: extra/, formatRun(extraPositionalRun));
assert.equal(extraPositionalRun.stdout, "", "extra positional validation errors should not print a password");

const mixedModeRun = runPassgen(["--mode", "strong", "ultra"]);
assertRunFailed(mixedModeRun, "mixing --mode with a positional preset should fail");
assert.match(mixedModeRun.stderr, /Use either a positional preset or --mode/, formatRun(mixedModeRun));
assert.equal(mixedModeRun.stdout, "", "ambiguous mode validation errors should not print a password");

for (const args of [["--lenght", "20"], ["-lenght", "20"], ["--password-size", "20"], ["--no-symbl", "20"]]) {
  const run = runPassgen(args);
  assertRunFailed(run, `unknown option should fail for ${args.join(" ")}`);
  assert.match(run.stderr, /Unknown arguments?/, formatRun(run));
  assert.equal(run.stdout, "", "unknown option validation should not print a password");
}

const noCharsetRun = runPassgen(["--no-upper", "--no-lower", "--no-numbers", "--no-symbols"]);
assertRunFailed(noCharsetRun, "disabling every character set should fail");
assert.match(noCharsetRun.stderr, /No character sets enabled/, formatRun(noCharsetRun));
assert.equal(noCharsetRun.stdout, "", "empty charset validation should not print a password");

const infoRun = runPassgen(["--length", "16", "--info"]);
assertPasswordLength(infoRun, 16, "--info should still print only the generated password to stdout");
assert.match(infoRun.stderr, /Password Info/, formatRun(infoRun));
assert.match(infoRun.stderr, /Mode:\s+custom/, formatRun(infoRun));
assert.match(infoRun.stderr, /Coverage:\s+guaranteed/, formatRun(infoRun));
assert.match(infoRun.stderr, /Strength:/, formatRun(infoRun));

const reportRun = runPassgen(["strong", "--report"]);
assertPasswordLength(reportRun, 18, "--report should keep stdout script-friendly");
assert.match(reportRun.stderr, /Password Strength Report/, formatRun(reportRun));
assert.match(reportRun.stderr, /Entropy:/, formatRun(reportRun));
assert.match(reportRun.stderr, /Recommendations:/, formatRun(reportRun));

const jsonRun = runPassgen(["--length", "16", "--format", "json"]);
assertRunStatus(jsonRun, 0, "JSON output should succeed");
const jsonReport = JSON.parse(jsonRun.stdout);
assert.equal(jsonReport.password.length, 16, "JSON output should include the generated value");
assertReportSchema(jsonReport, 16);
assert.equal(jsonReport.redacted, false);
assert.equal(jsonReport.password_present, true);

const redactedJsonRun = runPassgen(["--length", "16", "--format", "json", "--redact"]);
assertRunStatus(redactedJsonRun, 0, "redacted JSON output should succeed");
const redactedJsonReport = JSON.parse(redactedJsonRun.stdout);
assert.equal(redactedJsonReport.password, "[redacted]", "--redact should remove the generated value from JSON output");
assertReportSchema(redactedJsonReport, 16);
assert.equal(redactedJsonReport.redacted, true);
assert.equal(redactedJsonReport.password_present, false);

const redactTextRun = runPassgen(["--redact"]);
assertRunFailed(redactTextRun, "--redact should not silently pass through text output");
assert.match(redactTextRun.stderr, /--redact requires --format json/, formatRun(redactTextRun));
assert.equal(redactTextRun.stdout, "");

const quietWithoutOutputRun = runPassgen(["--quiet"]);
assertRunFailed(quietWithoutOutputRun, "--quiet without --output should fail instead of discarding a password");
assert.match(quietWithoutOutputRun.stderr, /--quiet requires --output/, formatRun(quietWithoutOutputRun));
assert.equal(quietWithoutOutputRun.stdout, "");

const tempDir = mkdtempSync(join(tmpdir(), "passgen-test-"));
try {
  const textPath = join(tempDir, "value.txt");
  const exportRun = runPassgen(["--length", "15", "--output", textPath]);
  assertRunStatus(exportRun, 0, "text export should succeed");
  assert.equal(exportRun.stdout.trim().length, 15);
  assert.equal(readFileSync(textPath, "utf8").trim().length, 15, "text export should write the generated value");

  const noOverwriteRun = runPassgen(["--output", textPath]);
  assertRunFailed(noOverwriteRun, "existing output file should not be overwritten by default");
  assert.match(noOverwriteRun.stderr, /already exists/, formatRun(noOverwriteRun));

  const quietTextPath = join(tempDir, "quiet-value.txt");
  const quietExportRun = runPassgen(["--length", "15", "--output", quietTextPath, "--quiet"]);
  assertRunStatus(quietExportRun, 0, "quiet text export should succeed");
  assert.equal(quietExportRun.stdout, "", "--quiet should suppress stdout when exporting to a file");
  assert.equal(readFileSync(quietTextPath, "utf8").trim().length, 15, "quiet text export should still write the generated value");

  const jsonPath = join(tempDir, "report.json");
  const jsonExportRun = runPassgen(["ultra", "--format", "json", "--output", jsonPath]);
  assertRunStatus(jsonExportRun, 0, "JSON export should succeed");
  const exportedReport = JSON.parse(readFileSync(jsonPath, "utf8"));
  assertReportSchema(exportedReport, 32);
  assert.equal(exportedReport.password_present, true);

  const nestedPath = join(tempDir, "nested", "exports", "value.txt");
  const nestedExportRun = runPassgen(["--length", "15", "--output", nestedPath, "--quiet"]);
  assertRunStatus(nestedExportRun, 0, "nested text export should succeed");
  assert.equal(readFileSync(nestedPath, "utf8").trim().length, 15, "missing parent directories should be created safely");

  const badTextExtensionRun = runPassgen(["--output", join(tempDir, "value.json")]);
  assertRunFailed(badTextExtensionRun, "text output should reject misleading JSON extension");
  assert.match(badTextExtensionRun.stderr, /text output must use .txt extension/, formatRun(badTextExtensionRun));

  const badJsonExtensionRun = runPassgen(["--format", "json", "--output", join(tempDir, "report.txt")]);
  assertRunFailed(badJsonExtensionRun, "JSON output should reject misleading text extension");
  assert.match(badJsonExtensionRun.stderr, /json output must use .json extension/, formatRun(badJsonExtensionRun));

  const directoryTarget = join(tempDir, "directory-target.txt");
  mkdirSync(directoryTarget);
  const directoryTargetRun = runPassgen(["--output", directoryTarget]);
  assertRunFailed(directoryTargetRun, "directory output targets should fail before generation");
  assert.match(directoryTargetRun.stderr, /Output path is a directory/, formatRun(directoryTargetRun));

  const fileParent = join(tempDir, "file-parent");
  writeFileSync(fileParent, "not a directory");
  const fileParentRun = runPassgen(["--output", join(fileParent, "value.txt")]);
  assertRunFailed(fileParentRun, "file parent output targets should fail before generation");
  assert.match(fileParentRun.stderr, /Output parent path is not a directory/, formatRun(fileParentRun));
  assert.equal(existsSync(join(fileParent, "value.txt")), false, "invalid parent path should not create a partial output file");
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}

const helpRun = runPassgen(["--help"]);
assertRunStatus(helpRun, 0, "help output should be available");
assert.match(helpRun.stdout, /Usage: passgen \[preset\] \[options\]/, formatRun(helpRun));
assert.match(helpRun.stdout, /Examples:/, formatRun(helpRun));
assert.match(helpRun.stdout, /Safe defaults:/, formatRun(helpRun));
assert.match(helpRun.stdout, /--report/, formatRun(helpRun));
assert.match(helpRun.stdout, /--format/, formatRun(helpRun));
assert.match(helpRun.stdout, /Generated passwords are printed to stdout/, formatRun(helpRun));
assert.match(helpRun.stdout, /Treat generated values as secrets/, formatRun(helpRun));
assert.equal(helpRun.stderr, "", "help output should stay on stdout for CLI discoverability");

console.log("passgen CLI smoke tests passed");
