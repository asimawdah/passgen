[![npm version](https://img.shields.io/npm/v/@asimawdah/passgen.svg)](https://www.npmjs.com/package/@asimawdah/passgen) [![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE) [![Node.js](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)](https://nodejs.org/)

# passgen

> Secure, minimal, and fast command-line password generator for professionals.

passgen is a compact Node.js CLI that produces cryptographically secure passwords using the Node `crypto` API. It provides sensible presets (weak, medium, strong, ultra) and fine-grained flags for including/excluding uppercase, lowercase, numbers, and symbols.

## Highlights

- Uses Node's built-in `crypto.randomInt` for secure randomness
- Preset strength modes (weak, medium, strong, ultra)
- CLI-friendly flags and positional preset (e.g. `passgen ultra`)
- Validates preset names, password length, empty character sets, and unknown options before generating output
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
```

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
- an unknown option is provided, such as a typo in `--length`

This keeps automation and scripts safer because invalid input fails loudly instead of producing surprising output.

### Recovery hints

When validation fails, passgen prints a short hint after the error so the next action is clear:

| Problem | Example | Suggested fix |
| --- | --- | --- |
| Invalid length | `passgen --length 0` | Use an integer in the supported range, such as `passgen --length 20`. |
| Unknown preset | `passgen maximum` | Use `weak`, `medium`, `strong`, or `ultra`, or run `passgen --help`. |
| Empty character set | `passgen --upper false --lower false --numbers false --symbols false` | Enable at least one character set. |
| Unknown option | `passgen --lenght 20` | Fix the option name or run `passgen --help` to review supported flags. |

These hints are written to stderr, while generated passwords remain on stdout. This makes `--info` and validation output safer for scripts that capture only the generated password.

## Testing

Run the CLI smoke tests before publishing or changing generation behavior:

```bash
npm test
```

The tests cover default output length, custom lengths, disabled character sets, invalid lengths, unknown modes, unknown options, empty charset failures, validation recovery hints, and `--info` output separation between stdout and stderr.

## Security notes

- passgen relies on Node's `crypto` for random number generation; do not use non-cryptographic RNGs for password generation.
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
