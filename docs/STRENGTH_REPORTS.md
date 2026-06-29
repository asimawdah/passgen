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

## File export

Use `--output` to save the current output format to a local file.

```bash
passgen strong --output ./generated.txt
passgen ultra --format json --output ./generated-report.json
```

passgen refuses to overwrite an existing output file by default. Add `--force` only when replacing the target file is intentional.

```bash
passgen ultra --format json --output ./generated-report.json --force
```

Where supported by the operating system, files are created with owner-only permissions.

## Practical safety notes

- Prefer `strong` or `ultra` for important accounts.
- Treat JSON exports as sensitive because they include the generated value.
- Avoid public logs, screenshots, chat, issue comments, and unencrypted long-term storage.
- Prefer importing directly into a password manager when possible.