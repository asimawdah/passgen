[![npm version](https://img.shields.io/npm/v/@asimawdah/passgen.svg)](https://www.npmjs.com/package/@asimawdah/passgen) [![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE) [![Node.js](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)](https://nodejs.org/)

# passgen

> Secure, minimal, and fast command-line password generator for professionals.

passgen is a compact Node.js CLI that produces cryptographically secure passwords using the Node `crypto` API. It provides sensible presets (weak, medium, strong, ultra), fine-grained flags for including/excluding uppercase, lowercase, numbers, and symbols, and optional strength reports for safer review and automation.

## Highlights

- Uses Node's built-in `crypto.randomInt` for secure randomness
- Preset strength modes (weak, medium, strong, ultra)
- CLI-friendly flags and positional preset (e.g. `passgen ultra`)
- Optional readable and JSON strength reports with entropy, enabled sets, and warnings
- Redacted JSON reports for sharing strength metadata without exposing the generated password
- Local file export with overwrite protection and optional quiet mode
- Validates preset names, password length, and empty character sets before generating output
- Small single-file implementation for easy auditing and embedding

## Installation

Install globally from npm:

```bash
npm install -g @asimawdah/passgen
```

Or run without installing using `npx`:

```bash
npx @asimawdah/passgen ultra
```

To install from the repository directory (local testing):

```bash
npm install -g .
```

## Usage

Basic usage with preset:

```bash
passgen
```

Result: `Y@XE4+mNi1dh`

Using flags:

```bash
passgen --mode strong
passgen -l 20 -u true -lc true -n true -s false
```

### Flags

- `-l`, `--length` (number): Password length (default: 12; valid range: 1-4096)
- `-u`, `--upper` (boolean): Include uppercase letters
- `-lc`, `--lower` (boolean): Include lowercase letters
- `-n`, `--numbers` (boolean): Include digits
- `-s`, `--symbols` (boolean): Include symbols
- `--mode` (string): Preset mode — `weak | medium | strong | ultra`
- `-i`, `--info` (boolean): Show password strength and entropy info
- `-r`, `--report` (boolean): Show a readable strength report on stderr
- `--format` (string): Output format — `text | json` (default: `text`)
- `--redact` (boolean): Redact the generated password from JSON output and JSON exports
- `-o`, `--output` (string): Save the current output format to a local file
- `-q`, `--quiet` (boolean): Suppress stdout when `--output` is used
- `--force` (boolean): Allow `--output` to overwrite an existing file

## Examples

```bash
# Generate an ultra password (32 chars)
passgen ultra

# Strong preset
passgen --mode strong

# Custom length without symbols
passgen -l 16 -s false

# Generate digits only
passgen -l 24 -u false -lc false -n true -s false

# Show a readable strength report while keeping stdout password-only
passgen strong --report

# Emit password and metadata as JSON
passgen ultra --format json

# Emit shareable metadata without exposing the generated password
passgen ultra --format json --redact

# Export text output or JSON output to a local file
passgen strong --output ./generated.txt
passgen ultra --format json --output ./generated-report.json
passgen ultra --format json --redact --output ./redacted-report.json

# Export without also printing the generated value to stdout
passgen ultra --output ./generated.txt --quiet
```

## Strength reports and exports

`--report` writes a human-readable report to stderr and keeps stdout as the generated password only. This preserves existing shell workflows such as `PASSWORD="$(passgen ultra --report)"`.

`--format json` emits a JSON object containing:

- `password`
- `preset`
- `length`
- `charset_size`
- `enabled_sets`
- `entropy_bits`
- `strength`
- `warnings`

Use `--redact` with `--format json` when the metadata is meant for review, logs, bug reports, or screenshots. The JSON keeps the same metadata fields, replaces `password` with `[redacted]`, and adds `redacted: true`.

`--output` saves the selected output format to a local file. Existing files are protected by default; use `--force` only when replacement is intentional. Add `--quiet` when exporting should not also print the generated value or JSON report to stdout. See [`docs/STRENGTH_REPORTS.md`](docs/STRENGTH_REPORTS.md) for details.

## Shell-safe usage

Generated passwords can contain symbols that have special meaning in shells. Capture or paste them carefully so they are not expanded, split, or leaked into logs.

```bash
# Capture a password for immediate local use without printing it again.
PASSWORD="$(passgen ultra)"

# Pass it to a command through stdin when the receiving tool supports it.
printf '%s\n' "$PASSWORD" | your-password-manager import --stdin

# Clear the variable when you are done using it.
unset PASSWORD
```

Avoid adding generated passwords directly to shell history, CI logs, issue comments, or unencrypted files. When sharing commands in documentation or bug reports, use placeholders such as `<generated-password>` instead of real generated values.

## Validation behavior

passgen exits with a non-zero status and writes the error to stderr when:

- `--length` is not an integer between 1 and 4096
- `--mode` or the positional preset is not one of `weak`, `medium`, `strong`, or `ultra`
- all character sets are disabled at the same time
- `--output` targets an existing file without `--force`
- `--quiet` is used without `--output`

This keeps automation and scripts safer because invalid input fails loudly instead of producing surprising output.

## Testing

Run the CLI smoke tests before publishing or changing generation behavior:

```bash
npm test
```

The tests cover default output length, custom lengths, disabled character sets, invalid lengths, unknown modes, empty charset failures, readable reports, JSON reports, redacted JSON reports, quiet exports, and output-file overwrite protection.

## Security notes

- passgen relies on Node's `crypto` for random number generation; do not use non-cryptographic RNGs for password generation.
- Avoid piping passwords through logs or unencrypted channels.
- Prefer long passwords generated with the `strong` or `ultra` preset for important accounts.
- Treat JSON reports and exported files as sensitive unless `--redact` is used and the original generated password is handled separately.
- Use `--quiet` with `--output` when saving sensitive output should not also print it to terminal logs.

## Contributing

Contributions and issues are welcome. Please open an issue or submit a pull request following standard Node.js project conventions. Run the test suite locally using:

```bash
npm test
```

## License

MIT — see the `LICENSE` file.
