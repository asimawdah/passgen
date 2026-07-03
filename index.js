#!/usr/bin/env node

import crypto from "crypto";
import { existsSync, mkdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, extname } from "node:path";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import chalk from "chalk";

const rawArgs = hideBin(process.argv);
const MIN_LENGTH = 1;
const MAX_LENGTH = 4096;
const REPORT_SCHEMA_VERSION = 2;
const FORMAT_VALUES = ["text", "json"];
const BOOLEAN_OPTIONS = ["upper", "lower", "numbers", "symbols"];
const SUPPORTED_OPTIONS = [
    "length",
    ...BOOLEAN_OPTIONS,
    ...BOOLEAN_OPTIONS.map((option) => `no-${option}`),
    "mode",
    "info",
    "report",
    "format",
    "output",
    "redact",
    "force",
    "quiet",
    "help",
];
const SUPPORTED_MODES = ["weak", "medium", "strong", "ultra"];
const OPTION_ALIASES = {
    l: "length",
    u: "upper",
    lc: "lower",
    n: "numbers",
    s: "symbols",
    i: "info",
    r: "report",
    o: "output",
    q: "quiet",
};
const OUTPUT_EXTENSIONS = {
    text: [".txt"],
    json: [".json"],
};
const HELP_EPILOGUE = [
    "Examples:",
    "  passgen ultra",
    "  passgen --mode strong",
    "  passgen --length 20 --no-symbols",
    "  passgen --length 20 --info",
    "  passgen strong --report",
    "  passgen ultra --format json --redact",
    "  passgen --length 20 --output ./password.txt --quiet",
    "",
    "Safe defaults:",
    "  Default output uses length 12 with lowercase, uppercase, numbers, and symbols.",
    "  Presets strong and ultra are recommended for important accounts.",
    "  Generated passwords are printed to stdout; diagnostics and validation hints go to stderr.",
    "  Treat generated values as secrets and avoid pasting them into logs, issue comments, or screenshots.",
].join("\n");

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

    const normalized = option.replace(/^-+/, "").trim().toLowerCase();
    if (normalized.startsWith("no-")) {
        const suggestion = suggestChoice(normalized.slice(3), BOOLEAN_OPTIONS);
        return suggestion ? `no-${suggestion}` : null;
    }

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

function normalizeOptionName(option) {
    const normalized = option.replace(/^-+/, "").trim().toLowerCase();
    return OPTION_ALIASES[normalized] ?? normalized;
}

function buildMissingValueHint(option) {
    const normalized = normalizeOptionName(option);

    if (normalized === "length") {
        return "Provide a numeric length, for example `passgen --length 20`, or run `passgen --help`.";
    }

    if (normalized === "mode") {
        return `Provide a preset for --mode, for example \`passgen --mode strong\`. Supported presets: ${SUPPORTED_MODES.join(", ")}.`;
    }

    if (normalized === "format") {
        return `Provide an output format: ${FORMAT_VALUES.join(" or ")}.`;
    }

    if (normalized === "output") {
        return "Provide a file path, for example `passgen --output ./password.txt`.";
    }

    if (BOOLEAN_OPTIONS.includes(normalized)) {
        return `Provide true or false for --${normalized}, or use --${normalized}/--no-${normalized} without a value.`;
    }

    return `Provide a value for --${normalized}, or run \`passgen --help\`.`;
}

function buildParserHint(message) {
    const missingValueOption = extractMissingValueOption(message);
    if (missingValueOption) {
        return buildMissingValueHint(missingValueOption);
    }

    const unknownOption = extractUnknownOption(message);
    const suggestion = suggestOption(unknownOption);

    return suggestion
        ? `Did you mean --${suggestion}? Run \`passgen --help\` to see supported options and examples.`
        : "Run `passgen --help` to see supported options and examples.";
}

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
    .scriptName("passgen")
    .usage("Usage: $0 [preset] [options]")
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
    .strictOptions()
    .fail((message) => {
        fail(message, buildParserHint(message));
    })
    .help()
    .epilogue(HELP_EPILOGUE)
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

const firstPositional = positionalPresets[0];
let selectedMode = null;
if (firstPositional && !argv.mode) {
    selectedMode = firstPositional.trim().toLowerCase();
    argv.mode = selectedMode;
} else if (argv.mode) {
    selectedMode = argv.mode.trim().toLowerCase();
    argv.mode = selectedMode;
}

const presets = {
    weak: { length: 10, upper: false, numbers: true, symbols: false },
    medium: { length: 14, upper: true, numbers: true, symbols: false },
    strong: { length: 18, upper: true, numbers: true, symbols: true },
    ultra: { length: 32, upper: true, numbers: true, symbols: true },
};

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

let config = {
    length: 12,
    upper: true,
    lower: true,
    numbers: true,
    symbols: true,
};

if (argv.mode) {
    if (!Object.hasOwn(presets, argv.mode)) {
        fail(
            `Unknown mode "${argv.mode}". Use one of: ${SUPPORTED_MODES.join(", ")}`,
            buildModeHint(argv.mode),
        );
    }

    config = { ...config, ...presets[argv.mode] };
}

if (argv.length !== undefined) config.length = argv.length;

if (!Number.isInteger(config.length) || config.length < MIN_LENGTH || config.length > MAX_LENGTH) {
    fail(
        `Password length must be an integer between ${MIN_LENGTH} and ${MAX_LENGTH}`,
        "Use `--length 20` or a preset such as `passgen strong`.",
    );
}

if (argv.quiet && !argv.output) {
    fail("--quiet requires --output so generated content is not discarded.");
}

if (argv.redact && argv.format !== "json") {
    fail("--redact requires --format json because text output is always the generated password.");
}

function validateOutputTarget(path) {
    if (!path) return;

    const allowedExtensions = OUTPUT_EXTENSIONS[argv.format];
    const actualExtension = extname(path).toLowerCase();
    if (!allowedExtensions.includes(actualExtension)) {
        fail(`${argv.format} output must use ${allowedExtensions.join(" or ")} extension: ${path}`);
    }

    if (existsSync(path) && statSync(path).isDirectory()) {
        fail(`Output path is a directory, not a file: ${path}`);
    }

    const parent = dirname(path);
    if (parent && parent !== ".") {
        if (existsSync(parent) && !statSync(parent).isDirectory()) {
            fail(`Output parent path is not a directory: ${parent}`);
        }

        if (!existsSync(parent)) {
            mkdirSync(parent, { recursive: true });
        }
    }
}

validateOutputTarget(argv.output);

if (argv.upper !== undefined) config.upper = argv.upper;
if (argv.lower !== undefined) config.lower = argv.lower;
if (argv.numbers !== undefined) config.numbers = argv.numbers;
if (argv.symbols !== undefined) config.symbols = argv.symbols;

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

function generate(len) {
    const requiredChars = enabledSets.map((set) => randomChar(set.chars));
    const remainingLength = len - requiredChars.length;
    const remainingChars = [];

    for (let i = 0; i < remainingLength; i += 1) {
        remainingChars.push(randomChar(charset));
    }

    return shuffle([...requiredChars, ...remainingChars]);
}

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

function buildRecommendations(report) {
    const recommendations = [];

    if (report.entropy_bits < 80) {
        recommendations.push("Use `passgen strong` or increase `--length` until entropy is at least 80 bits for important accounts.");
    }
    if (!report.enabled_sets.includes("symbols")) {
        recommendations.push("Enable symbols with `--symbols true` when the target service allows them.");
    }
    if (report.length < 14) {
        recommendations.push("Use at least 14 characters for general accounts and 18+ characters for high-value accounts.");
    }
    if (report.password_present) {
        recommendations.push("Store the generated password directly in a password manager and avoid pasting it into logs, chat, screenshots, or issue comments.");
    }

    if (recommendations.length === 0) {
        recommendations.push("This configuration is suitable for typical password-manager storage; keep the generated value out of logs and shell history.");
    }

    return recommendations;
}

function buildReport(password) {
    const entropyBits = Number((config.length * Math.log2(charset.length)).toFixed(1));
    const report = {
        schema_version: REPORT_SCHEMA_VERSION,
        generated_at: new Date().toISOString(),
        password,
        password_present: true,
        preset: selectedMode ?? "custom",
        length: config.length,
        charset_size: charset.length,
        enabled_sets: enabledSets.map((set) => set.name),
        enabled_set_labels: enabledSets.map((set) => set.label),
        required_sets: enabledSets.length,
        coverage: "guaranteed",
        entropy_bits: entropyBits,
        strength: strength(config.length, charset.length),
    };

    return {
        ...report,
        warnings: buildWarnings(report),
        recommendations: buildRecommendations(report),
    };
}

function buildSerializableReport(report) {
    const baseReport = {
        ...report,
        redacted: false,
    };

    if (!argv.redact) return baseReport;

    const redactedReport = {
        ...baseReport,
        password: "[redacted]",
        password_present: false,
        redacted: true,
    };

    return {
        ...redactedReport,
        recommendations: buildRecommendations(redactedReport),
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
    const enabledSetLabels = report.enabled_set_labels.join(", ");

    const lines = [
        "",
        "=== Password Strength Report ===",
        `Preset:       ${report.preset}`,
        `Length:       ${report.length}`,
        `Minimum:      ${report.required_sets} chars for enabled-set coverage`,
        `Charset:      ${report.charset_size} chars (${enabledSetLabels})`,
        `Required:     ${report.required_sets} of ${report.required_sets} sets represented`,
        `Coverage:     ${report.coverage}`,
        `Entropy:      ${report.entropy_bits} bits`,
        `Strength:     ${report.strength}`,
    ];

    if (report.warnings.length) {
        lines.push("Warnings:");
        for (const warning of report.warnings) {
            lines.push(`- ${warning}`);
        }
    }

    if (report.recommendations.length) {
        lines.push("Recommendations:");
        for (const recommendation of report.recommendations) {
            lines.push(`- ${recommendation}`);
        }
    }

    lines.push("===============================", "");

    return lines
        .map((line) => (line === `Strength:     ${report.strength}` ? chalk.gray("Strength:     ") + colorStrength(report.strength) : chalk.gray(line)))
        .join("\n");
}

function renderInfo(report) {
    const strengthColors = {
        Weak: chalk.red,
        Medium: chalk.yellow,
        Strong: chalk.green,
        Ultra: chalk.cyan,
    };
    const strengthColor = strengthColors[report.strength] || chalk.white;

    console.error(chalk.gray("\n=== Password Info ==="));
    console.error(chalk.gray("Mode:      ") + chalk.white(report.preset));
    console.error(chalk.gray("Length:    ") + chalk.white(report.length));
    console.error(chalk.gray("Minimum:   ") + chalk.white(report.required_sets) + chalk.gray(" chars for enabled-set coverage"));
    console.error(chalk.gray("Charset:   ") + chalk.white(report.charset_size) + chalk.gray(" chars"));
    console.error(chalk.gray("Sets:      ") + chalk.white(report.enabled_set_labels.join(", ")));
    console.error(chalk.gray("Required:  ") + chalk.white(`${report.required_sets} of ${report.required_sets} sets represented`));
    console.error(chalk.gray("Coverage:  ") + chalk.white(report.coverage));
    console.error(chalk.gray("Entropy:   ") + chalk.white(report.entropy_bits) + chalk.gray(" bits"));
    console.error(chalk.gray("Strength:  ") + strengthColor(report.strength));
    console.error(chalk.gray("=====================\n"));
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
            fail(`Output file already exists: ${path}. Use --force to overwrite it.`);
        }

        fail(`Failed to write output file: ${error.message}`);
    }
}

const result = generate(config.length);
const report = buildReport(result);
const serializableReport = buildSerializableReport(report);
const stdoutContent = argv.format === "json" ? `${JSON.stringify(serializableReport, null, 2)}\n` : `${result}\n`;

if (argv.info) {
    renderInfo(report);
}

if (argv.report) {
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
