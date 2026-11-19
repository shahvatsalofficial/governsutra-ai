# Security Policy

## Reporting a vulnerability

Please report vulnerabilities **privately** through GitHub: open the repository's **Security** tab and choose **Report a vulnerability** (private advisory). Do not open a public issue and do not publish exploit details before a coordinated fix. This is a volunteer project; there is no SLA, but reports are triaged as soon as practical.

Useful details: affected version (`governsutra version`), OS and Node version, a minimal reproduction using synthetic data, and the impact you expect.

## Supported versions

| Version | Supported |
|---|---|
| 0.2.x | Yes |
| 0.1.x | No (upgrade; 0.2.0 fixes Windows path handling and adds bounded parsing) |

## Scope and design

GovernSutra is local-first and dependency-free. The optional API is read-only, binds to `127.0.0.1`, needs a bearer token of at least 24 characters, rejects non-GET methods and any `Origin` header, and must not be reverse-proxied to the public internet without a separate production security design.

Hash-chained logs and SHA-256 report seals are **tamper-evident, not cryptographically signed or immutable**. An administrator who can rewrite the whole file can recompute them.

Never store secrets, raw personal data, credentials or production prompts in the registry or evidence directory. The tool refuses `.env`, key files and its own workspace as evidence, but it cannot recognise every secret.

## In scope

Path traversal, symlink escape, secret leakage into reports or scan results, report injection (HTML or Markdown), API authentication or write bypass, unbounded file reads, prototype pollution or crashes from hostile manifests, and false-assurance bugs (anything that turns UNKNOWN into pass).

## Out of scope

Legal, regulatory or safety conclusions about your AI system; vulnerabilities in third-party tools; attacks requiring write access to your workspace files (documented residual risk).
