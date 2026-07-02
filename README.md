[![npm version](https://img.shields.io/npm/v/@asimawdah/passgen.svg)](https://www.npmjs.com/package/@asimawdah/passgen) [![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE) [![Node.js](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)](https://nodejs.org/)

# passgen

> Secure, minimal, and fast command-line password generator for professionals.

passgen is a compact Node.js CLI that produces cryptographically secure passwords using the Node `crypto` API. It provides sensible presets (weak, medium, strong, ultra) and fine-grained flags for including/excluding uppercase, lowercase, numbers, and symbols.

## Highlights

- Uses Node's built-in `crypto.randomInt` for secure randomness
- Preset strength modes (weak, medium, strong, ultra)
- CLI-friendly flags and positional preset (e.g. `passgen ultra`)
- Validates preset names, password length, missing option values, empty character sets, unknown options, extra positional arguments, mixed preset styles, and impossible character-set coverage before generating output
- Supports explicit boolean disabling with either `--symbols false` or standard negated flags such as `--no-symbols`
- Normalizes preset casing/spacing and suggests the nearest supported preset or option for common typos
- Ensures every enabled character set appears at least once when the requested length allows it
- `--info` reports the selected mode, active character sets, and whether coverage is guaranteed while keeping the generated password on stdout
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
passgen --length 20 --no-symbols
```

### Flags

- `-l`, `--length` (number): Password length (default: 12; valid range: 1-4096)
- `-u`, `--upper` / `--no-upper` (boolean): Include uppercase letters
- `-lc`, `--lower` / `--no-lower` (boolean): Include lowercase letters
- `-n`, `--numbers` / `--no-numbers` (boolean): Include digits
- `-s`, `--symbols` / `--no-symbols` (boolean): Include symbols
- `--mode` (string): Preset mode — `weak | medium | strong | ultra`
- `-i`, `--info` (boolean): Show password strength, entropy, selected mode, enabled-set, and coverage info

## Examples

```bash
# Generate an ultra password (32 chars)
passgen ultra

# Strong preset
passgen --mode strong

# Preset names are normalized before validation
passgen ULTRA
passgen --mode " strong "

# Custom length without symbols
passgen -l 16 -s false
passgen --length 16 --no-symbols

# Generate digits only
passgen -l 24 -u false -lc false -n true -s false
passgen --length 24 --no-upper --no-lower --no-symbols

# Print the password on stdout and diagnostics on stderr
passgen --length 20 --info
```

## Character-set coverage

When multiple character sets are enabled, passgen now guarantees that every enabled set appears at least once in the generated password. For example, the default enabled sets are lowercase, uppercase, numbers, and symbols, so `passgen --length 4` returns one character from each enabled set in a randomized order.

If the requested length is shorter than the number of enabled sets, generation fails before printing a password:

```bash
passgen --length 3
```

Suggested fixes:

- Increase the length, for example `passgen --length 4` when all four sets are enabled.
- Disable character sets that are not needed, for example `passgen --length 3 --symbols false` or `passgen --length 3 --no-symbols`.

This prevents a short password from silently missing a selected character category while still being reported as generated from that category pool.

### Info output

`--info` prints diagnostics to stderr and keeps the password itself on stdout. This lets scripts safely capture only the generated password while humans can still review the generation settings.

The diagnostics include:

- `Mode`: selected preset, or `custom` when no preset was used
- `Length`: requested output length
- `Charset`: size of the active character pool
- `Sets`: enabled sets, such as `lowercase, uppercase, numbers, symbols`
- `Coverage`: `guaranteed` when every enabled set is represented at least once
- `Entropy`: estimated entropy in bits
- `Strength`: readable strength bucket

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
- `--length` or `--mode` is provided without a value
- `--length` is shorter than the number of enabled character sets
- `--mode` or the positional preset is not one of `weak`, `medium`, `strong`, or `ultra` after casing and surrounding whitespace are normalized
- more than one positional preset is provided, such as `passgen strong ultra`
- a positional preset is mixed with `--mode`, such as `passgen --mode strong ultra`
- all character sets are disabled at the same time
- an unknown option is provided, such as a typo in `--length` or `--no-symbols`

This keeps automation and scripts safer because invalid input fails loudly instead of producing surprising output.

### Recovery hints

When validation fails, passgen prints a short hint after the error so the next action is clear:

| Problem | Example | Suggested fix |
| --- | --- | --- |
| Invalid length | `passgen --length 0` | Use an integer in the supported range, such as `passgen --length 20`. |
| Missing length value | `passgen --length` | Provide a numeric length, for example `passgen --length 20`, or run `passgen --help`. |
| Missing mode value | `passgen --mode` | Provide a preset, for example `passgen --mode strong`; supported presets are `weak`, `medium`, `strong`, and `ultra`. |
| Length too short for enabled sets | `passgen --length 3` | Increase length or disable a character set, such as `passgen --length 3 --symbols false`. |
| Unknown preset | `passgen maximum` | Use `weak`, `medium`, `strong`, or `ultra`, or run `passgen --help`. |
| Typoed preset | `passgen --mode streng` | Use the suggested preset when shown, such as `strong`. |
| Extra positional argument | `passgen strong extra` | Use one positional preset only, such as `passgen strong`. |
| Mixed preset styles | `passgen --mode strong ultra` | Use `passgen strong` or `passgen --mode strong`, not both forms. |
| Empty character set | `passgen --upper false --lower false --numbers false --symbols false` | Enable at least one character set. |
| Unknown option | `passgen --lenght 20` | Fix the option name or run `passgen --help` to review supported flags. |
| Unknown negated option | `passgen --no-symbl` | Use the suggested negated flag when shown, such as `--no-symbols`. |

These hints are written to stderr, while generated passwords remain on stdout. This makes `--info` and validation output safer for scripts that capture only the generated password.

## Testing

Run the CLI smoke tests before publishing or changing generation behavior:

```bash
npm test
```

The tests cover default output length, custom lengths, disabled character sets, `--no-*` boolean flags, required enabled-set coverage, invalid lengths, tailored missing option value hints, too-short character-set coverage failures, preset normalization, typoed preset hints, unknown modes, extra positional arguments, mixed preset styles, unknown options, typoed negated option hints, empty charset failures, validation recovery hints, `--info` output separation between stdout and stderr, selected-mode diagnostics, enabled-set diagnostics, and coverage diagnostics.

## Security notes

- passgen relies on Node's `crypto` for random number generation; do not use non-cryptographic RNGs for password generation.
- Enabled character sets are guaranteed to be represented when the requested length is long enough, then shuffled with secure randomness.
- Avoid piping passwords through logs or unencrypted channels.
- Prefer long passwords generated with the `strong` or `ultra` preset for important accounts.
- Treat generated passwords as secrets immediately; do not paste real outputs into GitHub issues, pull requests, CI logs, or screenshots.

## Contributing

Contributions and issues are welcome. Please open an issue or submit a pull request following standard Node.js project conventions. Run the test suite locally using:

```bash
npm test
```

## License

MIT — see the `LICENSE` file.
