# Strength reports and exports

passgen can print a generated value with extra strength metadata for review, automation, and safer local workflows.

## Human-readable report

Use `--report` when a readable summary is needed without changing stdout.

```bash
passgen strong --report
```

The report is written to stderr and includes:

- selected preset
- generated length
- enabled character sets
- character pool size
- estimated entropy in bits
- strength label
- warnings for short length, low entropy, or disabled symbols

stdout still contains only the generated value, so existing shell scripts can continue to capture the command output.

## JSON output

Use JSON when another local tool needs both the generated value and the metadata.

```bash
passgen ultra --format json
```

Fields include `password`, `preset`, `length`, `charset_size`, `enabled_sets`, `entropy_bits`, `strength`, and `warnings`.

## Redacted JSON output

Use `--redact` when the JSON metadata needs to be reviewed, attached to a bug report, pasted into logs, or shown in documentation without exposing the generated password.

```bash
passgen ultra --format json --redact
```

The redacted report keeps the strength metadata, replaces `password` with `[redacted]`, and adds `redacted: true` so downstream tooling can tell that the generated value was intentionally removed.

`--redact` only affects JSON output and JSON exports. Plain text output remains the generated password so existing shell scripts do not silently receive a placeholder.

## File export

Use `--output` to save the current output format to a local file.

```bash
passgen strong --output ./generated.txt
passgen ultra --format json --output ./generated-report.json
passgen ultra --format json --redact --output ./redacted-report.json
```

passgen refuses to overwrite an existing output file by default. Add `--force` only when replacing the target file is intentional.

```bash
passgen ultra --format json --output ./generated-report.json --force
```

Where supported by the operating system, files are created with owner-only permissions.

## Practical safety notes

- Prefer `strong` or `ultra` for important accounts.
- Treat JSON exports as sensitive because they include the generated value unless `--redact` is used.
- Avoid public logs, screenshots, chat, issue comments, and unencrypted long-term storage.
- Prefer importing directly into a password manager when possible.
