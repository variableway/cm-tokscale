# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Tokscale is a high-performance CLI tool and web dashboard for tracking AI coding assistant token usage and costs across multiple platforms (OpenCode, Claude Code, Codex CLI, Gemini CLI, Cursor IDE, Amp, Droid, OpenClaw, Kimi Code CLI). Monorepo with npm workspaces managed by Bun.

## Build & Development Commands

```bash
bun install                    # Install all workspace dependencies (triggers core build via postinstall)
bun run build                  # Build everything (core + CLI)
bun run build:core             # Build native Rust module (release)
bun run build:cli              # Build CLI TypeScript to dist/
bun run build:core:debug       # Build Rust core in debug mode (faster compilation)
bun run cli                    # Run CLI in dev mode (via scripts/cli.sh)

# Testing
cd packages/core && bun run test:rust    # Cargo tests only
cd packages/core && bun run test          # AVA Node.js integration tests only
cd packages/core && bun run test:all      # Both Rust and Node tests

# Benchmarks
cd packages/core && bun run bench         # Rust criterion benchmarks
cd packages/benchmarks && bun run generate && bun run run  # Generate synthetic data & benchmark

# Frontend
bun run dev:frontend                      # Next.js dev server
```

## Architecture

### Monorepo Structure

- **`packages/core/`** — Native Rust module (napi-rs bindings). High-performance session file scanning, parsing, and aggregation.
- **`packages/cli/`** — TypeScript CLI with Commander.js. Table output (`--light`) and TUI mode (OpenTUI + Solid.js).
- **`packages/frontend/`** — Next.js 16 + React 19 web visualization (tokscale.ai). Drizzle ORM + Neon PostgreSQL.
- **`packages/tokscale/`** — Alias package that depends on `@tokscale/cli`.
- **`packages/benchmarks/`** — Synthetic data generation and benchmarking scripts.

### Core Data Flow

1. **Scanning** (`scanner.rs`): Parallel directory traversal with walkdir + rayon across platform-specific session directories
2. **Parsing** (`sessions/*.rs`): Each platform has a dedicated parser converting to unified `UnifiedMessage` format
3. **Aggregation** (`aggregator.rs`): Parallel map-reduce grouping by date with metric calculation
4. **Pricing** (`pricing/`): LiteLLM primary + OpenRouter fallback, 1-hour disk cache, alias resolution and fuzzy matching
5. **Output**: CLI table/TUI rendering, JSON export, or graph data generation

### Key Rust Modules (`packages/core/src/`)

- `lib.rs` — NAPI entry points, exports JS-callable functions
- `scanner.rs` — File discovery with platform-specific path resolution
- `parser.rs` — JSON parsing orchestration with simd-json
- `aggregator.rs` — Parallel aggregation pipeline
- `sessions/` — Platform parsers: `opencode.rs`, `claudecode.rs`, `codex.rs`, `gemini.rs`, `cursor.rs`, `amp.rs`, `droid.rs`, `openclaw.rs`, `pi.rs`, `kimi.rs`
- `pricing/` — `litellm.rs`, `openrouter.rs`, `aliases.rs` (model name resolution), `lookup.rs` (multi-strategy lookup), `cache.rs`

### Key CLI Modules (`packages/cli/src/`)

- `cli.ts` — Commander.js entry point with all subcommands
- `native.ts` / `native-runner.ts` — Invokes the Rust core as a subprocess
- `table.ts` — Table rendering for `--light` mode
- `tui/` — Solid.js + OpenTUI interactive terminal UI
- `cursor.ts` — Cursor IDE API integration and credential management
- `auth.ts` / `submit.ts` — Social platform (GitHub OAuth, data submission)
- `wrapped.ts` — Year-in-review image generation

## Important Constraints

- **Bun is required** as the runtime/package manager. The TUI depends on OpenTUI's native Zig modules which only work with Bun.
- **Rust toolchain** is required for building the native core from source. Native binaries are pre-built for published npm packages.
- The native core runs as a subprocess (not in-process). `native-runner.ts` spawns it and parses JSON output. Environment variables `TOKSCALE_NATIVE_TIMEOUT_MS` and `TOKSCALE_MAX_OUTPUT_BYTES` control limits.
- Rust tests use `--features noop` flag to avoid requiring the full NAPI runtime.
- AVA tests in core use `workerThreads: false` and match `__test__/**/*.spec.mjs`.
- Platform session parsers in Rust each produce the same `UnifiedMessage` struct — new platform support means adding a new parser in `sessions/` and registering it in `scanner.rs`.
