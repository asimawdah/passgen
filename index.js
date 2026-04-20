#!/usr/bin/env node

import crypto from "crypto";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import chalk from "chalk";

const rawArgs = hideBin(process.argv);

// normalize args: convert single-dash multi-letter flags (e.g. `-lc`) to
// double-dash form (`--lc`) so users can type `-lc false` as they did.
const normalizedArgs = rawArgs.map((arg) => {
    if (arg.startsWith("--")) return arg;
    if (arg.startsWith("-") && !/^-[0-9]/.test(arg) && arg.length > 2 && !arg.includes("=")) {
        return `--${arg.slice(1)}`;
    }
    return arg;
});

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
    .help()
    .argv;

// support positional preset (e.g., `node index.js ultra`)
const firstPositional = normalizedArgs.find((a) => !a.startsWith("-"));
if (firstPositional && !argv.mode) {
    argv.mode = firstPositional;
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

// ---------------- merge config ----------------
let config = {
    length: 12,
    upper: true,
    lower: true,
    numbers: true,
    symbols: true,
};

// apply preset first
if (argv.mode && presets[argv.mode]) {
    config = { ...config, ...presets[argv.mode] };
}

// override by user (FULL CONTROL)
if (argv.length) config.length = argv.length;

if (argv.upper !== undefined) config.upper = argv.upper;
if (argv.lower !== undefined) config.lower = argv.lower;
if (argv.numbers !== undefined) config.numbers = argv.numbers;
if (argv.symbols !== undefined) config.symbols = argv.symbols;

// ---------------- build charset ----------------
let charset = "";

if (config.lower) charset += sets.lower;
if (config.upper) charset += sets.upper;
if (config.numbers) charset += sets.numbers;
if (config.symbols) charset += sets.symbols;

if (!charset) {
    console.log(chalk.red("❌ No character sets enabled"));
    process.exit(1);
}

// ---------------- secure generator ----------------
function generate(len) {
    let pass = "";

    for (let i = 0; i < len; i++) {
        const idx = crypto.randomInt(0, charset.length);
        pass += charset[idx];
    }

    return pass;
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

    let strengthColor = chalk.green;
    if (passStrength === "Weak") strengthColor = chalk.red;
    else if (passStrength === "Medium") strengthColor = chalk.yellow;
    else if (passStrength === "Ultra") strengthColor = chalk.cyan;

    console.error(chalk.gray(`\n=== Password Info ===`));
    console.error(chalk.gray(`Length:    `) + chalk.white(config.length));
    console.error(chalk.gray(`Charset:   `) + chalk.white(charset.length) + chalk.gray(` chars`));
    console.error(chalk.gray(`Entropy:   `) + chalk.white(entropy) + chalk.gray(` bits`));
    console.error(chalk.gray(`Strength:  `) + strengthColor(passStrength));
    console.error(chalk.gray(`=====================\n`));
}

console.log(result);