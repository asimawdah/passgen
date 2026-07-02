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

const noSymbolsRun = runPassgen(["--length", "20", "--no-symbols"]);
assert.equal(noSymbolsRun.status, 0, noSymbolsRun.stderr);
assert.equal(noSymbolsRun.stdout.trim().length, 20, "negated boolean flags should be supported");
assert.doesNotMatch(noSymbolsRun.stdout.trim(), /[!@#$%^&*()\-_=+\[\]{}<>?/|]/, "--no-symbols should exclude symbols");

const ultraRun = runPassgen(["ultra"]);
assert.equal(ultraRun.status, 0, ultraRun.stderr);
assert.equal(ultraRun.stdout.trim().length, 32, "ultra positional preset should generate 32 characters");

const uppercasePresetRun = runPassgen(["ULTRA"]);
assert.equal(uppercasePresetRun.status, 0, uppercasePresetRun.stderr);
assert.equal(uppercasePresetRun.stdout.trim().length, 32, "uppercase positional presets should normalize to the supported preset");

const paddedFlagPresetRun = runPassgen(["--mode", " strong "]);
assert.equal(paddedFlagPresetRun.status, 0, paddedFlagPresetRun.stderr);
assert.equal(paddedFlagPresetRun.stdout.trim().length, 18, "--mode values with surrounding spaces should normalize safely");

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

const decimalLengthRun = runPassgen(["--length", "3.5"]);
assert.notEqual(decimalLengthRun.status, 0, "decimal length should fail");
assert.match(decimalLengthRun.stderr, /Password length must be an integer/);

const missingLengthValueRun = runPassgen(["--length"]);
assert.notEqual(missingLengthValueRun.status, 0, "missing length value should fail without generating a password");
assert.match(missingLengthValueRun.stderr, /Not enough arguments following: length/);
assert.match(missingLengthValueRun.stderr, /Hint: Provide a numeric length/);
assert.match(missingLengthValueRun.stderr, /passgen --length 20/);
assert.equal(missingLengthValueRun.stdout, "", "missing option values should not print a generated password");

const missingModeValueRun = runPassgen(["--mode"]);
assert.notEqual(missingModeValueRun.status, 0, "missing mode value should fail without generating a password");
assert.match(missingModeValueRun.stderr, /Not enough arguments following: mode/);
assert.match(missingModeValueRun.stderr, /Hint: Provide a preset for --mode/);
assert.match(missingModeValueRun.stderr, /passgen --mode strong/);
assert.match(missingModeValueRun.stderr, /weak, medium, strong, ultra/);
assert.doesNotMatch(missingModeValueRun.stderr, /--mode 20/);
assert.equal(missingModeValueRun.stdout, "", "missing mode values should not print a generated password");

const tooShortForSetsRun = runPassgen(["--length", "3"]);
assert.notEqual(tooShortForSetsRun.status, 0, "length shorter than enabled character sets should fail");
assert.match(tooShortForSetsRun.stderr, /too short for 4 enabled character sets/);
assert.match(tooShortForSetsRun.stderr, /lowercase, uppercase, numbers, symbols/);
assert.match(tooShortForSetsRun.stderr, /Hint: Use --length 4/);
assert.equal(tooShortForSetsRun.stdout, "", "class coverage validation errors should not print a password");

const unknownFlagModeRun = runPassgen(["--mode", "maximum"]);
assert.notEqual(unknownFlagModeRun.status, 0, "unknown --mode value should fail");
assert.match(unknownFlagModeRun.stderr, /Unknown mode/);
assert.match(unknownFlagModeRun.stderr, /Use one of: weak, medium, strong, ultra/);

const typoedModeRun = runPassgen(["--mode", "streng"]);
assert.notEqual(typoedModeRun.status, 0, "typoed --mode value should fail");
assert.match(typoedModeRun.stderr, /Unknown mode/);
assert.match(typoedModeRun.stderr, /Hint: Did you mean "strong"\?/);
assert.equal(typoedModeRun.stdout, "", "typoed mode validation errors should not print a password");

const unknownPositionalModeRun = runPassgen(["maximum"]);
assert.notEqual(unknownPositionalModeRun.status, 0, "unknown positional mode should fail");
assert.match(unknownPositionalModeRun.stderr, /Unknown mode/);

const extraPositionalRun = runPassgen(["strong", "extra"]);
assert.notEqual(extraPositionalRun.status, 0, "extra positional arguments should fail instead of being ignored");
assert.match(extraPositionalRun.stderr, /Unexpected positional arguments: extra/);
assert.match(extraPositionalRun.stderr, /Hint: Use at most one positional preset/);
assert.equal(extraPositionalRun.stdout, "", "extra positional validation errors should not print a password");

const mixedModeRun = runPassgen(["--mode", "strong", "ultra"]);
assert.notEqual(mixedModeRun.status, 0, "mixing --mode with a positional preset should fail");
assert.match(mixedModeRun.stderr, /Use either a positional preset or --mode/);
assert.match(mixedModeRun.stderr, /not both forms/);
assert.equal(mixedModeRun.stdout, "", "ambiguous mode validation errors should not print a password");

const unknownOptionRun = runPassgen(["--lenght", "20"]);
assert.notEqual(unknownOptionRun.status, 0, "unknown options should fail instead of generating a default password");
assert.match(unknownOptionRun.stderr, /Unknown argument: lenght|Unknown arguments: lenght/);
assert.match(unknownOptionRun.stderr, /Hint: Did you mean --length\?/);
assert.equal(unknownOptionRun.stdout, "", "validation errors should not print a generated password to stdout");

const unknownShortOptionRun = runPassgen(["-lenght", "20"]);
assert.notEqual(unknownShortOptionRun.status, 0, "normalized typoed short options should fail");
assert.match(unknownShortOptionRun.stderr, /Unknown argument: lenght|Unknown arguments: lenght/);
assert.match(unknownShortOptionRun.stderr, /Hint: Did you mean --length\?/);
assert.equal(unknownShortOptionRun.stdout, "", "normalized option validation errors should not print a password");

const unknownNegatedOptionRun = runPassgen(["--no-symbl", "20"]);
assert.notEqual(unknownNegatedOptionRun.status, 0, "typoed negated boolean options should fail safely");
assert.match(unknownNegatedOptionRun.stderr, /Unknown argument: no-symbl|Unknown arguments: no-symbl/);
assert.match(unknownNegatedOptionRun.stderr, /Hint: Did you mean --no-symbols\?/);
assert.equal(unknownNegatedOptionRun.stdout, "", "negated option validation errors should not print a password");

const unknownFarOptionRun = runPassgen(["--password-size", "20"]);
assert.notEqual(unknownFarOptionRun.status, 0, "unsupported unrelated options should fail");
assert.match(unknownFarOptionRun.stderr, /Unknown argument: password-size|Unknown arguments: password-size/);
assert.match(unknownFarOptionRun.stderr, /Hint: Run `passgen --help`/);
assert.doesNotMatch(unknownFarOptionRun.stderr, /Did you mean/);

const noCharsetRun = runPassgen(["--upper", "false", "--lower", "false", "--numbers", "false", "--symbols", "false"]);
assert.notEqual(noCharsetRun.status, 0, "disabling every character set should fail");
assert.match(noCharsetRun.stderr, /No character sets enabled/);
assert.match(noCharsetRun.stderr, /Hint: Enable at least one/);

const infoRun = runPassgen(["--length", "16", "--info"]);
assert.equal(infoRun.status, 0, infoRun.stderr);
assert.equal(infoRun.stdout.trim().length, 16, "--info should still print only the generated password to stdout");
assert.match(infoRun.stderr, /Password Info/);
assert.match(infoRun.stderr, /Mode:\s+custom/);
assert.match(infoRun.stderr, /Length:\s+16/);
assert.match(infoRun.stderr, /Minimum:\s+4 chars for enabled-set coverage/);
assert.match(infoRun.stderr, /Sets:\s+lowercase, uppercase, numbers, symbols/);
assert.match(infoRun.stderr, /Required:\s+4 of 4 sets represented/);
assert.match(infoRun.stderr, /Coverage:\s+guaranteed/);
assert.match(infoRun.stderr, /Entropy:/);
assert.match(infoRun.stderr, /Strength:/);

const presetInfoRun = runPassgen(["--mode", "strong", "--info"]);
assert.equal(presetInfoRun.status, 0, presetInfoRun.stderr);
assert.match(presetInfoRun.stderr, /Mode:\s+strong/);
assert.match(presetInfoRun.stderr, /Length:\s+18/);
assert.match(presetInfoRun.stderr, /Minimum:\s+4 chars for enabled-set coverage/);
assert.match(presetInfoRun.stderr, /Required:\s+4 of 4 sets represented/);

const lowerOnlyInfoRun = runPassgen(["--upper", "false", "--numbers", "false", "--symbols", "false", "--info"]);
assert.equal(lowerOnlyInfoRun.status, 0, lowerOnlyInfoRun.stderr);
assert.match(lowerOnlyInfoRun.stderr, /Minimum:\s+1 chars for enabled-set coverage/);
assert.match(lowerOnlyInfoRun.stderr, /Sets:\s+lowercase/);
assert.match(lowerOnlyInfoRun.stderr, /Required:\s+1 of 1 sets represented/);
assert.doesNotMatch(lowerOnlyInfoRun.stderr, /uppercase, numbers, symbols/);

const helpRun = runPassgen(["--help"]);
assert.equal(helpRun.status, 0, helpRun.stderr);
assert.match(helpRun.stdout, /Usage: passgen \[preset\] \[options\]/);
assert.match(helpRun.stdout, /Examples:/);
assert.match(helpRun.stdout, /passgen ultra/);
assert.match(helpRun.stdout, /passgen --length 20 --no-symbols/);
assert.match(helpRun.stdout, /Safe defaults:/);
assert.match(helpRun.stdout, /Default output uses length 12/);
assert.match(helpRun.stdout, /Generated passwords are printed to stdout/);
assert.match(helpRun.stdout, /Treat generated values as secrets/);
assert.equal(helpRun.stderr, "", "help output should stay on stdout for CLI discoverability");

console.log("passgen CLI smoke tests passed");
