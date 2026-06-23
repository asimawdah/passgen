import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const cliPath = join(__dirname, "index.js");

function runPassgen(args = []) {
  return execFileSync(process.execPath, [cliPath, ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

const defaultPassword = runPassgen();
assert.equal(defaultPassword.length, 12, "default password should be 12 characters long");

const customPassword = runPassgen(["--length", "20", "--symbols", "false"]);
assert.equal(customPassword.length, 20, "custom length should be respected");
assert.doesNotMatch(customPassword, /[!@#$%^&*()\-_=+\[\]{}<>?/|]/, "symbols should be excluded when disabled");

const ultraPassword = runPassgen(["ultra"]);
assert.equal(ultraPassword.length, 32, "ultra positional preset should generate 32 characters");

const lowerOnlyPassword = runPassgen(["--upper", "false", "--numbers", "false", "--symbols", "false"]);
assert.match(lowerOnlyPassword, /^[a-z]+$/, "lower-only options should restrict the character set");

console.log("passgen CLI smoke tests passed");
