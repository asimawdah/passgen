[![npm version](https://img.shields.io/npm/v/@asimawdah/passgen.svg)](https://www.npmjs.com/package/@asimawdah/passgen) [![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE) [![Node.js](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)](https://nodejs.org/)

# passgen

> Secure, minimal, and fast command-line password generator for professionals.

passgen is a compact Node.js CLI that produces cryptographically secure passwords using the Node `crypto` API. It provides sensible presets (weak, medium, strong, ultra) and fine-grained flags for including/excluding uppercase, lowercase, numbers, and symbols.

## Highlights

- Uses Node's built-in `crypto.randomInt` for secure randomness
- Preset strength modes (weak, medium, strong, ultra)
- CLI-friendly flags and positional preset (e.g. `passgen ultra`)
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

- `-l`, `--length` (number): Password length (default: 12)
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
```

## Security notes

- passgen relies on Node's `crypto` for random number generation; do not use non-cryptographic RNGs for password generation.
- Avoid piping passwords through logs or unencrypted channels.

## Contributing

Contributions and issues are welcome. Please open an issue or submit a pull request following standard Node.js project conventions. Run the test suite locally using:

```bash
npm test
```

## License

MIT — see the `LICENSE` file.
