# Tokscale

High-performance CLI tool and web dashboard for tracking AI coding assistant token usage and costs.

## Supported Platforms

| Client | Data Location |
|--------|---------------|
| <img width="48px" src=".github/assets/client-opencode.png" alt="OpenCode" /> | [OpenCode](https://github.com/sst/opencode) — `~/.local/share/opencode/storage/message/` |
| <img width="48px" src=".github/assets/client-claude.jpg" alt="Claude" /> | [Claude Code](https://docs.anthropic.com/en/docs/claude-code) — `~/.claude/projects/` |
| <img width="48px" src=".github/assets/client-openai.jpg" alt="Codex" /> | [Codex CLI](https://github.com/openai/codex) — `~/.codex/sessions/` |
| <img width="48px" src=".github/assets/client-gemini.png" alt="Gemini" /> | [Gemini CLI](https://github.com/google-gemini/gemini-cli) — `~/.gemini/tmp/*/chats/` |
| <img width="48px" src=".github/assets/client-cursor.jpg" alt="Cursor" /> | [Cursor IDE](https://cursor.com/) — API sync via `~/.config/tokscale/cursor-cache/` |
| <img width="48px" src=".github/assets/client-amp.png" alt="Amp" /> | [Amp](https://ampcode.com/) — `~/.local/share/amp/threads/` |
| <img width="48px" src=".github/assets/client-droid.png" alt="Droid" /> | [Droid](https://factory.ai/) — `~/.factory/sessions/` |
| <img width="48px" src=".github/assets/client-openclaw.jpg" alt="OpenClaw" /> | [OpenClaw](https://openclaw.ai/) — `~/.openclaw/agents/` |
| <img width="48px" src=".github/assets/client-kimi.png" alt="Kimi" /> | [Kimi Code CLI](https://github.com/MoonshotAI/kimi-cli) — `~/.kimi/sessions/` |

## Quick Start

```bash
# Install and run
bunx tokscale@latest

# Filter by platform
tokscale --kimi
tokscale --claude --kimi
```
