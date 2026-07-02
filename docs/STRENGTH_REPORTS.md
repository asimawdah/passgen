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
- actionable recommendations for safer configuration and storage

stdout still contains only the generated value, so existing shell scripts can continue to capture the command output.

## JSON output

Use JSON when another local tool needs both the generated value and the metadata.

```bash
passgen ultra --format json
```

Fields include `schema_version`, `generated_at`, `password`, `password_present`, `preset`, `length`, `charset_size`, `enabled_sets`, `entropy_bits`, `strength`, `warnings`, `recommendations`, and `redacted`.

`schema_version` is currently `2` and gives scripts a stable contract to check before parsing report fields. `generated_at` is an ISO-8601 UTC timestamp that can be used in local audit trails. `warnings` describe detected risks, and `recommendations` gives downstream tools a stable list of practical next steps to show in UI, logs, or review screens. `redacted` is always present so automation can safely distinguish full reports from redacted reports. `password_present` is also always present so automation can tell whether the `password` field contains a generated secret or only a placeholder.

Recommendations are intentionally separate from warnings. A weak configuration can include warnings and direct remediation such as using `passgen strong`, increasing `--length`, or enabling symbols. A strong configuration still includes a safe-handling reminder so JSON consumers always have at least one user-facing next step.

## Redacted JSON output

Use `--redact` when the JSON metadata needs to be reviewed, attached to a bug report, pasted into logs, or shown in documentation without exposing the generated password.

```bash
passgen ultra --format json --redact
```

The redacted report keeps the strength metadata, replaces `password` with `[redacted]`, sets `redacted: true`, and sets `password_present: false` so downstream tooling can tell that the generated value is not included. Redacted recommendations keep configuration guidance but avoid claiming that the redacted placeholder should be stored as a generated secret.

`--redact` requires `--format json`. Plain text output always contains the generated password, so passgen rejects `--redact` in text mode instead of silently printing an unredacted secret.

## File export

Use `--output` to save the current output format to a local file.

```bash
passgen strong --output ./generated.txt
passgen ultra --format json --output ./generated-report.json
passgen ultra --format json --redact --output ./redacted-report.json
```

passgen validates export targets before generating a password:

- text exports must use `.txt`
- JSON exports must use `.json`
- directory targets are rejected
- parent paths that already exist as files are rejected
- missing parent directories are created recursively
- existing files are refused unless `--force` is used

This keeps failed export commands from producing a secret that is only visible in logs or terminal scrollback.

```bash
passgen ultra --format json --output ./reports/generated-report.json --force
```

Where supported by the operating system, files are created with owner-only permissions.

## Quiet exports

By default, `--output` writes the selected output format to the file and still prints the same content to stdout. This keeps pipelines predictable.

Use `--quiet` when the generated value or full JSON report should only be written to the target file and not echoed into terminal output, CI logs, or shell history captures.

```bash
passgen ultra --output ./generated.txt --quiet
passgen ultra --format json --output ./generated-report.json --quiet
```

`--quiet` requires `--output`. This prevents accidentally generating a password that is discarded with no visible or saved result.

## Practical safety notes

- Prefer `strong` or `ultra` for important accounts.
- Treat JSON exports as sensitive because they include the generated value unless `redacted` is `true` and `password_present` is `false`.
- Avoid public logs, screenshots, chat, issue comments, and unencrypted long-term storage.
- Use `--quiet` with `--output` when saved secrets should not also appear in terminal output.
- Prefer importing directly into a password manager when possible.
- Delete local exported secrets after importing them into secure storage.
