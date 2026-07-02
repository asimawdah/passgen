import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const indexSource = readFileSync(new URL("./index.js", import.meta.url), "utf8");
const readme = readFileSync(new URL("./README.md", import.meta.url), "utf8");
const security = readFileSync(new URL("./SECURITY.md", import.meta.url), "utf8");
const validationContract = readFileSync(new URL("./docs/CLI_VALIDATION_CONTRACT.md", import.meta.url), "utf8");

function assertIncludes(source, expected, label) {
  assert.ok(
    source.includes(expected),
    `${label} should include ${JSON.stringify(expected)} to preserve the issue #8 validation contract`,
  );
}

function assertMatches(source, pattern, label) {
  assert.match(
    source,
    pattern,
    `${label} should match ${pattern} to preserve the issue #8 validation contract`,
  );
}

assertIncludes(indexSource, "strictOptions()", "CLI parser");
assertIncludes(indexSource, "buildParserHint", "CLI parser");
assertIncludes(indexSource, "buildMissingValueHint", "CLI parser");
assertIncludes(indexSource, "No character sets enabled", "CLI charset validation");
assertIncludes(indexSource, "too short for", "CLI coverage validation");
assertIncludes(indexSource, "Use either a positional preset or --mode", "CLI preset validation");
assertIncludes(indexSource, "Unexpected positional arguments", "CLI preset validation");
assertIncludes(indexSource, "Generated passwords are printed to stdout", "CLI help output");
assertIncludes(indexSource, "Treat generated values as secrets", "CLI help output");

assertMatches(readme, /Generated passwords can contain symbols/, "README shell-safe guidance");
assertMatches(readme, /passgen exits with a non-zero status/, "README validation behavior");
assertMatches(readme, /These hints are written to stderr/, "README stdout\/stderr guidance");
assertMatches(readme, /Treat generated passwords as secrets/, "README security notes");

assertMatches(security, /Do not paste generated passwords into GitHub issues/i, "SECURITY.md issue guidance");
assertMatches(security, /logs/i, "SECURITY.md log guidance");

assertMatches(validationContract, /Generated passwords are the only successful output written to stdout/, "validation contract output separation");
assertMatches(validationContract, /At least one character set must remain enabled/, "validation contract charset guard");
assertMatches(validationContract, /Positional presets and `--mode` values are normalized/, "validation contract preset guard");
assertMatches(validationContract, /Unknown options must fail before generation/, "validation contract option guard");
assertMatches(validationContract, /`npm test` should continue to cover/, "validation contract regression guard");

console.log("passgen validation contract checks passed");
