# Security Policy

passgen is a local CLI password generator. Treat every generated value as a secret from the moment it appears.

## Supported versions

Security fixes should target the latest release and the `main` branch. Older versions may not receive patches unless the issue is severe and easy to backport.

## Reporting a vulnerability

Do not paste generated passwords into GitHub issues, issue comments, pull requests, screenshots, CI logs, shell history, or public chat messages.

Please do not open a public issue with a real generated password, token, private key, or account credential.

Open a GitHub issue with a minimal reproduction that uses placeholders such as `<generated-password>`, or contact the maintainer through the repository profile if private coordination is needed.

Include:

- passgen version and Node.js version
- operating system and shell
- exact command with secrets replaced by placeholders
- expected behavior
- actual behavior

## Safe handling notes

- Generated passwords are printed to stdout by design so scripts can capture them.
- Validation errors and `--info` output are printed to stderr to keep stdout clean for automation.
- Do not store generated passwords in unencrypted text files, CI logs, shell history, screenshots, or issue comments.
- Prefer a password manager or another encrypted storage system for long-term storage.
- Use `strong` or `ultra` for important accounts unless a service has strict length or character-set limits.
