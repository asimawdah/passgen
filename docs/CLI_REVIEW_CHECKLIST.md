# CLI review checklist

Use this checklist when reviewing changes that touch password generation, CLI parsing, validation, or documentation. It turns the issue #8 safety requirements into a practical pre-merge review gate.

## Safety boundaries

- Generated passwords remain the only successful stdout output.
- `--info` diagnostics, validation errors, and recovery hints stay on stderr.
- Failed validation does not generate or print a password.
- Help output can remain on stdout for CLI discoverability.
- Generated example values in docs are placeholders or clearly non-secret examples.

## Validation boundaries

- Length validation rejects missing, decimal, zero, negative, and out-of-range values before generation.
- At least one character set must be enabled.
- Requested length must be long enough to represent every enabled character set.
- Unknown options fail loudly and should include safe suggestions only for close typos.
- Missing option values use option-specific hints instead of generic parser output.
- Positional presets and `--mode` values are normalized for casing and surrounding whitespace.
- Extra positional arguments and mixed preset styles fail instead of being silently ignored.

## Security guidance

- README, built-in help, and `SECURITY.md` remind users not to paste generated passwords into logs, issue comments, pull requests, screenshots, or unencrypted files.
- Shell-safe examples capture output without echoing secrets back to logs.
- Docs prefer `strong` or `ultra` for important accounts.

## Regression expectations

- `npm test` should run the CLI smoke suite and static contract guards.
- New CLI behavior should include a direct smoke test when it changes parsing, output separation, or generated-password guarantees.
- New docs that describe CLI safety should be included in static review checks so safety guidance does not drift from implementation.
