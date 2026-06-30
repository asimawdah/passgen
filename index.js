#!/usr/bin/env node

import crypto from "crypto";
import { writeFileSync } from "node:fs";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import chalk from "chalk";

const rawArgs = hideBin(process.argv);
const MIN_LENGTH = 1;
const MAX_LENGTH = 4096;
const FORMAT_VALUES = ["text", "json"];

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
    .option("report", {
        alias: "r",
        type: "boolean",
        default: false,
        describe: "Show a readable strength report on stderr",
    })
    .option("format", {
        type: "string",
        default: "text",
        choices: FORMAT_VALUES,
        describe: "Output format for stdout and --output: text | json",
    })
    .option("output", {
        alias: "o",
        type: "string",
        describe: "Write the generated password or JSON report to a file",
    })
    .option("redact", {
        type: "boolean",
        default: false,
        describe: "Redact the generated password from JSON output and JSON exports",
    })
    .option("force", {
        type: "boolean",
        default: false,
        describe: "Allow --output to overwrite an existing file",
    })
    .option("quiet", {
        alias: "q",
        type: "boolean",
        default: false,
        describe: "Suppress stdout when writing output to a file",
    })
    .help()
    .argv;

// support positional preset (e.g., `node index.js ultra`) without mistaking
// option values such as `--length 20` or `--output ./file` for presets.
const firstPositional = argv._.length ? String(argv._[0]) : undefined;
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
if (argv.mode) {
    if (!Object.hasOwn(presets, argv.mode)) {
        console.error(chalk.red(`❌ Unknown mode "${argv.mode}". Use one of: ${Object.keys(presets).join(", ")}`));
        process.exit(1);
    }

    config = { ...config, ...presets[argv.mode] };
}

// override by user (FULL CONTROL)
if (argv.length !== undefined) config.length = argv.length;

if (!Number.isInteger(config.length) || config.length < MIN_LENGTH || config.length > MAX_LENGTH) {
    console.error(chalk.red(`❌ Password length must be an integer between ${MIN_LENGTH} and ${MAX_LENGTH}`));
    process.exit(1);
}

if (argv.quiet && !argv.output) {
    console.error(chalk.red("❌ --quiet requires --output so generated content is not discarded."));
    process.exit(1);
}

if (argv.upper !== undefined) config.upper = argv.upper;
if (argv.lower !== undefined) config.lower = argv.lower;
if (argv.numbers !== undefined) config.numbers = argv.numbers;
if (argv.symbols !== undefined) config.symbols = argv.symbols;

// ---------------- build charset ----------------
let charset = "";
const enabledSets = [];

if (config.lower) {
    charset += sets.lower;
    enabledSets.push("lower");
}
if (config.upper) {
    charset += sets.upper;
    enabledSets.push("upper");
}
if (config.numbers) {
    charset += sets.numbers;
    enabledSets.push("numbers");
}
if (config.symbols) {
    charset += sets.symbols;
    enabledSets.push("symbols");
}

if (!charset) {
    console.error(chalk.red("❌ No character sets enabled"));
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

// ---------------- entropy and reports ----------------
function strength(len, pool) {
    const e = len * Math.log2(pool);

    if (e < 50) return "Weak";
    if (e < 80) return "Medium";
    if (e < 120) return "Strong";
    return "Ultra";
}

function buildWarnings(report) {
    const warnings = [];

    if (report.entropy_bits < 80) {
        warnings.push("Entropy is below 80 bits; use a longer password or a larger character pool for important accounts.");
    }
    if (!report.enabled_sets.includes("symbols")) {
        warnings.push("Symbols are disabled; this may be required by some systems, but it reduces the character pool.");
    }
    if (report.length < 14) {
        warnings.push("Length is below 14 characters; prefer strong or ultra presets for important accounts.");
    }

    return warnings;
}

function buildReport(password) {
    const entropyBits = Number((config.length * Math.log2(charset.length)).toFixed(1));
    const report = {
        password,
        preset: argv.mode || "custom",
        length: config.length,
        charset_size: charset.length,
        enabled_sets: enabledSets,
        entropy_bits: entropyBits,
        strength: strength(config.length, charset.length),
    };

    return {
        ...report,
        warnings: buildWarnings(report),
    };
}

function buildSerializableReport(report) {
    if (!argv.redact) return report;

    return {
        ...report,
        password: "[redacted]",
        redacted: true,
    };
}

function renderReadableReport(report) {
    const strengthColors = {
        Weak: chalk.red,
        Medium: chalk.yellow,
        Strong: chalk.green,
        Ultra: chalk.cyan,
    };
    const colorStrength = strengthColors[report.strength] || chalk.white;

    const lines = [
        "",
        "=== Password Strength Report ===",
        `Preset:       ${report.preset}`,
        `Length:       ${report.length}`,
        `Charset:      ${report.charset_size} chars (${report.enabled_sets.join(", ")})`,
        `Entropy:      ${report.entropy_bits} bits`,
        `Strength:     ${report.strength}`,
    ];

    if (report.warnings.length) {
        lines.push("Warnings:");
        for (const warning of report.warnings) {
            lines.push(`- ${warning}`);
        }
    }

    lines.push("===============================", "");

    return lines
        .map((line) => (line === `Strength:     ${report.strength}` ? chalk.gray("Strength:     ") + colorStrength(report.strength) : chalk.gray(line)))
        .join("\n");
}

function writeOutputFile(path, content) {
    try {
        writeFileSync(path, content, {
            encoding: "utf8",
            flag: argv.force ? "w" : "wx",
            mode: 0o600,
        });
    } catch (error) {
        if (error && error.code === "EEXIST") {
            console.error(chalk.red(`❌ Output file already exists: ${path}. Use --force to overwrite it.`));
            process.exit(1);
        }

        console.error(chalk.red(`❌ Failed to write output file: ${error.message}`));
        process.exit(1);
    }
}

// ---------------- output ----------------
const result = generate(config.length);
const report = buildReport(result);
const serializableReport = buildSerializableReport(report);
const stdoutContent = argv.format === "json" ? `${JSON.stringify(serializableReport, null, 2)}\n` : `${result}\n`;

if (argv.info || argv.report) {
    console.error(renderReadableReport(report));
}

if (argv.output) {
    writeOutputFile(argv.output, stdoutContent);
    const savedKind = argv.format === "json" && argv.redact ? "redacted report" : argv.format === "json" ? "report" : "password";
    console.error(chalk.gray(`Saved generated ${savedKind} to ${argv.output}`));
}

if (!argv.quiet) {
    process.stdout.write(stdoutContent);
}
