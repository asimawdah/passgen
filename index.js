#!/usr/bin/env node

import crypto from "crypto";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import chalk from "chalk";

const rawArgs = hideBin(process.argv);
const MIN_LENGTH = 1;
const MAX_LENGTH = 4096;
const SUPPORTED_OPTIONS = ["length", "upper", "lower", "numbers", "symbols", "mode", "info", "help"];
const SUPPORTED_MODES = ["weak", "medium", "strong", "ultra"];

function editDistance(a, b) {
    const dp = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));

    for (let i = 0; i <= a.length; i += 1) dp[i][0] = i;
    for (let j = 0; j <= b.length; j += 1) dp[0][j] = j;

    for (let i = 1; i <= a.length; i += 1) {
        for (let j = 1; j <= b.length; j += 1) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            dp[i][j] = Math.min(
                dp[i - 1][j] + 1,
                dp[i][j - 1] + 1,
                dp[i - 1][j - 1] + cost,
            );
        }
    }

    return dp[a.length][b.length];
}

function suggestChoice(value, supportedValues, maxDistance = 2) {
    if (!value) return null;

    const normalized = value.trim().toLowerCase();
    let best = null;

    for (const supportedValue of supportedValues) {
        const distance = editDistance(normalized, supportedValue);
        if (!best || distance < best.distance) {
            best = { value: supportedValue, distance };
        }
    }

    return best && best.distance <= maxDistance ? best.value : null;
}

function suggestOption(option) {
    if (!option) return null;

    const normalized = option.replace(/^-+/, "");
    return suggestChoice(normalized, SUPPORTED_OPTIONS);
}

function buildModeHint(mode) {
    const suggestion = suggestChoice(mode, SUPPORTED_MODES);

    return suggestion
        ? `Did you mean "${suggestion}"? Use one of: ${SUPPORTED_MODES.join(", ")}.`
        : `Use one of: ${SUPPORTED_MODES.join(", ")}, or run \`passgen --help\`.`;
}

function extractUnknownOption(message) {
    const match = message.match(/Unknown arguments?:\s+([^,\s]+)/i);
    return match ? match[1].replace(/^--?/, "") : null;
}

function extractMissingValueOption(message) {
    const match = message.match(/Not enough arguments following:\s+([^\s]+)/i);
    return match ? match[1].replace(/^--?/, "") : null;
}

function buildParserHint(message) {
    const missingValueOption = extractMissingValueOption(message);
    if (missingValueOption) {
        return `Provide a value for --${missingValueOption}, for example \`passgen --${missingValueOption} 20\`, or run \`passgen --help\`.`;
    }

    const unknownOption = extractUnknownOption(message);
    const suggestion = suggestOption(unknownOption);

    return suggestion
        ? `Did you mean --${suggestion}? Run \`passgen --help\` to see supported options and examples.`
        : "Run `passgen --help` to see supported options and examples.";
}

// normalize args: convert single-dash multi-letter flags (e.g. `-lc`) to
// double-dash form (`--lc`) so users can type `-lc false` as they did.
const normalizedArgs = rawArgs.map((arg) => {
    if (arg.startsWith("--")) return arg;
    if (arg.startsWith("-") && !/^-[0-9]/.test(arg) && arg.length > 2 && !arg.includes("=")) {
        return `--${arg.slice(1)}`;
    }
    return arg;
});

function fail(message, hint) {
    console.error(chalk.red(`❌ ${message}`));
    if (hint) {
        console.error(chalk.gray(`Hint: ${hint}`));
    }
    process.exit(1);
}

const argv = yargs(normalizedArgs)
    .option("length", {
        alias: "l",
        type: "number",
        describe: "Password length",
    })
    .option("upper", {
        alias: "u",
        type: "boolean",
        default: undefined,
        describe: "Include uppercase letters",
    })
    .option("lower", {
        alias: "lc",
        type: "boolean",
        default: undefined,
        describe: "Include lowercase letters",
    })
    .option("numbers", {
        alias: "n",
        type: "boolean",
        default: undefined,
        describe: "Include numbers",
    })
    .option("symbols", {
        alias: "s",
        type: "boolean",
        default: undefined,
        describe: "Include symbols",
    })
    .option("mode", {
        type: "string",
        describe: "preset mode: weak | medium | strong | ultra",
    })
    .option("info", {
        alias: "i",
        type: "boolean",
        default: false,
        describe: "Show password strength and entropy info",
    })
    .strictOptions()
    .fail((message) => {
        fail(message, buildParserHint(message));
    })
    .help()
    .argv;

const positionalPresets = argv._.map(String);
if (positionalPresets.length > 1) {
    fail(
        `Unexpected positional arguments: ${positionalPresets.slice(1).join(", ")}`,
        "Use at most one positional preset, such as `passgen ultra`, or run `passgen --help`.",
    );
}

if (positionalPresets.length === 1 && argv.mode) {
    fail(
        "Use either a positional preset or --mode, not both",
        "Use `passgen ultra` or `passgen --mode ultra`, not both forms in the same command.",
    );
}

// support positional preset (e.g., `node index.js ultra`)
const firstPositional = positionalPresets[0];
let selectedMode = null;
if (firstPositional && !argv.mode) {
    selectedMode = firstPositional.trim().toLowerCase();
    argv.mode = selectedMode;
} else if (argv.mode) {
    selectedMode = argv.mode.trim().toLowerCase();
    argv.mode = selectedMode;
}

// ---------------- presets ----------------
const presets = {
    weak: { length: 10, upper: false, numbers: true, symbols: false },
    medium: { length: 14, upper: true, numbers: true, symbols: false },
    strong: { length: 18, upper: true, numbers: true, symbols: true },
    ultra: { length: 32, upper: true, numbers: true, symbols: true },
};

// ---------------- charset ----------------
const sets = {
    lower: "abcdefghijklmnopqrstuvwxyz",
    upper: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
    numbers: "0123456789",
    symbols: "!@#$%^&*()-_=+[]{}<>?/|",
};

const setLabels = {
    lower: "lowercase",
    upper: "uppercase",
    numbers: "numbers",
    symbols: "symbols",
};

// ---------------- merge config ----------------
let config = {
    length: 12,
    upper: true,
    lower: true,
    numbers: true,
    symbols: true,
};

// apply preset first
if (argv.mode) {
    if (!Object.hasOwn(presets, argv.mode)) {
        fail(
            `Unknown mode "${argv.mode}". Use one of: ${SUPPORTED_MODES.join(", ")}`,
            buildModeHint(argv.mode),
        );
    }

    config = { ...config, ...presets[argv.mode] };
}

// override by user (FULL CONTROL)
if (argv.length !== undefined) config.length = argv.length;

if (!Number.isInteger(config.length) || config.length < MIN_LENGTH || config.length > MAX_LENGTH) {
    fail(
        `Password length must be an integer between ${MIN_LENGTH} and ${MAX_LENGTH}`,
        "Use `--length 20` or a preset such as `passgen strong`.",
    );
}

if (argv.upper !== undefined) config.upper = argv.upper;
if (argv.lower !== undefined) config.lower = argv.lower;
if (argv.numbers !== undefined) config.numbers = argv.numbers;
if (argv.symbols !== undefined) config.symbols = argv.symbols;

// ---------------- build charset ----------------
const enabledSets = [];
let charset = "";

for (const [name, chars] of Object.entries(sets)) {
    if (config[name]) {
        enabledSets.push({ name, label: setLabels[name], chars });
        charset += chars;
    }
}

if (!charset) {
    fail(
        "No character sets enabled",
        "Enable at least one of --lower, --upper, --numbers, or --symbols.",
    );
}

if (config.length < enabledSets.length) {
    const enabledNames = enabledSets.map((set) => set.label).join(", ");
    fail(
        `Password length ${config.length} is too short for ${enabledSets.length} enabled character sets (${enabledNames})`,
        `Use --length ${enabledSets.length} or disable character sets you do not need.`,
    );
}

function randomChar(chars) {
    return chars[crypto.randomInt(0, chars.length)];
}

function shuffle(chars) {
    const shuffled = [...chars];
    for (let i = shuffled.length - 1; i > 0; i -= 1) {
        const j = crypto.randomInt(0, i + 1);
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled.join("");
}

// ---------------- secure generator ----------------
function generate(len) {
    const requiredChars = enabledSets.map((set) => randomChar(set.chars));
    const remainingLength = len - requiredChars.length;
    const remainingChars = [];

    for (let i = 0; i < remainingLength; i += 1) {
        remainingChars.push(randomChar(charset));
    }

    return shuffle([...requiredChars, ...remainingChars]);
}

// ---------------- entropy ----------------
function strength(len, pool) {
    const e = len * Math.log2(pool);

    if (e < 50) return "Weak";
    if (e < 80) return "Medium";
    if (e < 120) return "Strong";
    return "Ultra";
}

// ---------------- output ----------------
const result = generate(config.length);

if (argv.info) {
    const entropy = (config.length * Math.log2(charset.length)).toFixed(1);
    const passStrength = strength(config.length, charset.length);
    const enabledSetLabels = enabledSets.map((set) => set.label).join(", ");

    let strengthColor = chalk.green;
    if (passStrength === "Weak") strengthColor = chalk.red;
    else if (passStrength === "Medium") strengthColor = chalk.yellow;
    else if (passStrength === "Ultra") strengthColor = chalk.cyan;

    console.error(chalk.gray(`\n=== Password Info ===`));
    console.error(chalk.gray(`Mode:      `) + chalk.white(selectedMode ?? "custom"));
    console.error(chalk.gray(`Length:    `) + chalk.white(config.length));
    console.error(chalk.gray(`Charset:   `) + chalk.white(charset.length) + chalk.gray(` chars`));
    console.error(chalk.gray(`Sets:      `) + chalk.white(enabledSetLabels));
    console.error(chalk.gray(`Coverage:  `) + chalk.white("guaranteed"));
    console.error(chalk.gray(`Entropy:   `) + chalk.white(entropy) + chalk.gray(` bits`));
    console.error(chalk.gray(`Strength:  `) + strengthColor(passStrength));
    console.error(chalk.gray(`=====================\n`));
}

console.log(result);
