# IDE and Server Portability

Portable source of truth: `AGENTS.md`, `agents/`, `skills/`, `rules/`, `workflows/`, JSON schemas and CLI contracts. Host adapters are thin project-local instruction files copied by `install-ide`.

Supported adapter templates: Claude Code, Cursor, Codex-compatible AGENTS.md, Gemini CLI, GitHub Copilot, Windsurf, Cline, Roo Code and Continue. This means files can be generated into expected project conventions; it does **not** mean every host automatically loads every agent, tool or skill. Validate against the exact host/version and user configuration.

Server integration strategy: CLI and read-only localhost HTTP API are implemented. MCP server, webhooks, CI runners, SSO, remote multi-tenant hosting and write-capable connectors are future adapters requiring separate security review.
