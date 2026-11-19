# IDE Compatibility Matrix

| Host family | Project-local files generated | Native runtime verified | Notes |
|---|---:|---:|---|
| Claude Code | Yes | Partial: file generation only | `.claude/agents/`, `CLAUDE.md`; skills remain portable Markdown. |
| Cursor | Yes | No | `.cursor/rules/*.mdc`; validate current frontmatter/version. |
| Codex | Yes | No | Root `AGENTS.md` portable instruction convention. |
| Gemini CLI | Yes | No | `GEMINI.md` project context. |
| GitHub Copilot | Yes | No | `.github/copilot-instructions.md` and scoped instructions. |
| Windsurf | Yes | No | Project-local rules template; verify current product format. |
| Cline | Yes | No | `.clinerules/` template; verify version. |
| Roo Code | Yes | No | `.roo/rules/` template; verify version. |
| Continue | Yes | No | `.continue/rules/` template; verify version. |
| Other IDEs | Portable contract | No | Use AGENTS.md + SKILL.md + CLI; no universal IDE plugin format exists. |

No claim of universal support. A host adapter only supplies instructions. Tool execution, agent spawning, permission prompts and skill discovery depend on host features and versions.
