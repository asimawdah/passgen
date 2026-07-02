# CLI validation contract

This document captures the validation behavior expected from issue #8 so future CLI changes do not weaken safety or scriptability.

## Output separation

- Generated passwords are the only successful output written to stdout.
- Human diagnostics from `--info` are written to stderr.
- Validation errors and recovery hints are written to stderr.
- Failed validation must not print a generated password.
- `--help` remains on stdout so users and shell completions can discover supported options.

## Length validation

`--length` must be an integer between 1 and 4096. Missing, decimal, zero, negative, and out-of-range values must fail before generation and include a recovery hint that points to a valid numeric example such as `passgen --length 20`.

## Character-set validation

At least one character set must remain enabled. When multiple sets are enabled, the requested length must be at least the number of enabled sets so the generator can guarantee one character from each selected set.

The default configuration enables lowercase, uppercase, numbers, and symbols, so `passgen --length 4` is the minimum valid default length. `passgen --length 3` must fail unless a set is disabled.

## Preset validation

Supported presets are `weak`, `medium`, `strong`, and `ultra`.

- Positional presets and `--mode` values are normalized for casing and surrounding whitespace.
- Unknown presets must fail with the supported values listed.
- Close typos should include a suggestion when one is safe, such as `streng` -> `strong`.
- Extra positional values must fail instead of being silently ignored.
- A positional preset and `--mode` must not be mixed in the same command.

## Option validation

Unknown options must fail before generation. Close option typos should include a suggestion when the edit distance is low enough to be useful, such as `--lenght` -> `--length` and `--no-symbl` -> `--no-symbols`.

Missing option values should use option-specific hints:

- `--length`: ask for a numeric length.
- `--mode`: ask for a supported preset.
- Boolean flags: explain `true`/`false` values and the `--flag` / `--no-flag` forms.

## Security guidance

Built-in help, README guidance, and `SECURITY.md` should remind users that generated values are secrets and should not be pasted into logs, GitHub issues, pull requests, CI output, screenshots, or unencrypted files.

## Regression coverage

`npm test` should continue to cover the CLI behavior above plus a static contract guard that checks the implementation and documentation still mention the most important safety boundaries from issue #8.