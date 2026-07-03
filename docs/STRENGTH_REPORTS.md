# Strength reports and exports

passgen can print a generated password as plain text, describe the generated value with human-readable diagnostics, or emit a structured JSON report for automation.

## Readable reports

Use `--report` to keep the generated password on stdout and write the strength report to stderr:

```bash
passgen strong --report
```

The report includes:

- selected preset or `custom`
- output length
- active character-set size
- enabled character sets
- required set coverage
- estimated entropy in bits
- strength bucket: `Weak`, `Medium`, `Strong`, or `Ultra`
- warnings and practical recommendations

`--info` remains available for concise diagnostics and also keeps stdout script-friendly.

## JSON reports

Use `--format json` when another tool needs metadata:

```bash
passgen ultra --format json
```

JSON reports use `schema_version: 2` and include:

- `generated_at` as an ISO-8601 UTC timestamp
- `password`
- `password_present`
- `redacted`
- `preset`
- `length`
- `charset_size`
- `enabled_sets`
- `enabled_set_labels`
- `required_sets`
- `coverage`
- `entropy_bits`
- `strength`
- `warnings`
- `recommendations`

## Redacted JSON

Use `--redact` only with JSON output when the report must be shared without exposing the generated secret:

```bash
passgen ultra --format json --redact
```

Redacted reports replace the generated value with `[redacted]`, set `password_present` to `false`, and keep the metadata needed for review.

## Safe file exports

Use `--output` to write the same content that would normally go to stdout:

```bash
passgen --length 20 --output ./password.txt
passgen ultra --format json --redact --output ./report.json
```

Export safety rules:

- text output must use `.txt`
- JSON output must use `.json`
- existing files are not overwritten unless `--force` is provided
- missing parent directories are created
- directory targets and file parents fail before output is written
- files are written with owner-only permissions where the platform supports it

Use `--quiet` with `--output` to suppress stdout after the file is written:

```bash
passgen --length 20 --output ./password.txt --quiet
```

## Security notes

- Treat every generated password as a secret immediately.
- Prefer a password manager or encrypted storage instead of plain text files.
- Use redacted JSON for sharing strength metadata in issues, pull requests, chats, and logs.
- Avoid pasting generated values into screenshots, CI output, shell history, or public comments.
