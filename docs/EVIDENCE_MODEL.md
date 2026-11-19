# Evidence Model

Every evidence item should state: what claim it supports, artifact path or URI, source system, collection time, scope/environment, artifact version, SHA-256 digest, verifier, limitations, retention and expiry/review date.

Current starter behavior: evidence files must be inside the workspace, regular files, not symlinks, not secret-like paths and at most 2 MiB. The tool stores relative path and digest only; it does not assert that file content is truthful or sufficient. Evidence status is `reference-hashed-not-content-validated` until a human or future verifier reviews it.

The JSONL audit chain detects changed events and broken links. It is not a digital signature, append-only hardware store, WORM archive or proof against a privileged administrator rewriting the entire chain. Production needs signed attestations and external immutable storage.
