import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
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
assert.equal(defaultRun.stdout.trim().length, 12, "default password should be 12 characters long");

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
assert.match(invalidLengthRun.stderr, /Hint: Use `--length 20`/);

const decimalLengthRun = runPassgen(["--length", "3.5"]);
assert.notEqual(decimalLengthRun.status, 0, "decimal length should fail");
assert.match(decimalLengthRun.stderr, /Password length must be an integer/);

const unknownFlagModeRun = runPassgen(["--mode", "maximum"]);
assert.notEqual(unknownFlagModeRun.status, 0, "unknown --mode value should fail");
assert.match(unknownFlagModeRun.stderr, /Unknown mode/);
assert.match(unknownFlagModeRun.stderr, /Hint: Run `passgen --help`/);

const unknownPositionalModeRun = runPassgen(["maximum"]);
assert.notEqual(unknownPositionalModeRun.status, 0, "unknown positional mode should fail");
assert.match(unknownPositionalModeRun.stderr, /Unknown mode/);

const unknownOptionRun = runPassgen(["--lenght", "20"]);
assert.notEqual(unknownOptionRun.status, 0, "unknown options should fail instead of generating a default password");
assert.match(unknownOptionRun.stderr, /Unknown argument: lenght|Unknown arguments: lenght/);
assert.match(unknownOptionRun.stderr, /Hint: Run `passgen --help`/);
assert.equal(unknownOptionRun.stdout, "", "validation errors should not print a generated password to stdout");

const noCharsetRun = runPassgen(["--upper", "false", "--lower", "false", "--numbers", "false", "--symbols", "false"]);
assert.notEqual(noCharsetRun.status, 0, "disabling every character set should fail");
assert.match(noCharsetRun.stderr, /No character sets enabled/);
assert.match(noCharsetRun.stderr, /Hint: Enable at least one/);

const infoRun = runPassgen(["--length", "16", "--info"]);
assert.equal(infoRun.status, 0, infoRun.stderr);
assert.equal(infoRun.stdout.trim().length, 16, "--info should still print only the generated password to stdout");
assert.match(infoRun.stderr, /Password Info/);
assert.match(infoRun.stderr, /Entropy:/);
assert.match(infoRun.stderr, /Strength:/);

console.log("passgen CLI smoke tests passed");
