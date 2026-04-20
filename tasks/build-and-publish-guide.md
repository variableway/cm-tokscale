# Tokscale — Local Development & npm Publishing Guide

## Project Structure

```
tokscale-improved/
├── packages/
│   ├── core/       # @tokscale/core — Rust native module (napi-rs)
│   ├── cli/        # @tokscale/cli  — TypeScript CLI + TUI
│   ├── frontend/   # @tokscale/frontend — Next.js web dashboard (private)
│   ├── tokscale/   # tokscale — npm alias package for @tokscale/cli
│   └── benchmarks/ # Synthetic data generation & benchmarking
├── scripts/
│   └── cli.sh      # Dev runner with timing
├── .github/workflows/
│   └── publish-cli.yml  # CI/CD: cross-platform build + publish
└── tasks/          # Project analysis & specs
```

**Package dependency chain**: `tokscale` → `@tokscale/cli` → `@tokscale/core` (Rust)

---

## Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| **Bun** | >= 1.0 | Runtime, package manager, TUI (required) |
| **Rust** | stable | Compiling native core module |
| **Xcode CLT** | latest | C linker (macOS only) |

Install:

```bash
# Bun
curl -fsSL https://bun.sh/install | bash

# Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Xcode Command Line Tools (macOS)
xcode-select --install
```

---

## Part 1: Running Locally

### 1.1 Install & Build

```bash
# Clone and enter project
git clone <repo-url> tokscale-improved
cd tokscale-improved

# Install all workspace dependencies (triggers core build via postinstall)
bun install
```

`bun install` automatically runs `bun run build:core` which compiles the Rust module for your platform.

To build manually:

```bash
bun run build          # Build everything (core + CLI)
bun run build:core     # Rust only (release)
bun run build:cli      # TypeScript only (tsc)
bun run build:core:debug  # Rust debug mode (faster compile, slower runtime)
```

Verify the native binary was built:

```bash
ls packages/core/*.node
# Expected: tokscale-core.darwin-arm64.node (macOS ARM)
#   or: tokscale-core.linux-x64-gnu.node (Linux x64)
```

### 1.2 Run the CLI

```bash
# Recommended: via the wrapper script (includes timing)
bun run cli

# Or directly
bun packages/cli/src/cli.ts

# Or via the script
./scripts/cli.sh
```

**Output modes**:

```bash
bun run cli                    # Interactive TUI (default, requires Bun)
bun run cli -- --light         # Table mode (no TUI)
bun run cli -- --json          # JSON output
```

> **Note**: `bun run cli` passes `--` to separate Bun flags from CLI flags.

### 1.3 All CLI Commands

```bash
# Main views
tokscale                       # TUI dashboard (default)
tokscale models --light        # Usage by model (table)
tokscale monthly --light       # Usage by month (table)
tokscale model-dates           # All models, daily breakdown
tokscale model-dates gpt-5     # Specific model, daily breakdown
tokscale graph --output out.json  # Export graph JSON

# Multi-machine (new)
tokscale export --output machine-work.json   # Export local data
tokscale import machine-work.json --dry-run  # Preview import
tokscale import machine-work.json --label "work-laptop"

# Platform & date filters (apply to most commands)
tokscale models --claude --week
tokscale model-dates gpt-5 --since 2026-01-01 --until 2026-03-31
tokscale graph --codex --month --json

# Other
tokscale sources               # Show scan locations & session counts
tokscale pricing "claude-sonnet-4-20250514"
tokscale wrapped --year 2025
tokscale headless codex exec -m gpt-5 "task"
tokscale cursor login          # Cursor IDE integration
```

### 1.4 Run Tests

```bash
# Rust unit tests (150 tests)
cd packages/core && bun run test:rust

# Node.js integration tests (AVA)
cd packages/core && bun run test

# Both
cd packages/core && bun run test:all

# Rust benchmarks
cd packages/core && bun run bench

# Synthetic data benchmarks
cd packages/benchmarks && bun run generate && bun run run
```

### 1.5 Frontend (optional)

```bash
bun run dev:frontend           # Start Next.js dev server
```

### 1.6 Global Install via `bun link`

```bash
cd packages/cli
bun link

# Now available system-wide
tokscale
tokscale --light

# Unlink
bun unlink @tokscale/cli
```

---

## Part 2: Publishing to npm

### 2.1 Three Packages, One Version

All three publishable packages share the same version number:

| Package | npm Name | Contents |
|---------|----------|----------|
| `packages/core/` | `@tokscale/core` | Rust `.node` binaries (8 platforms) + JS glue |
| `packages/cli/` | `@tokscale/cli` | Compiled TypeScript `dist/` |
| `packages/tokscale/` | `tokscale` | Thin wrapper with `bin/tokscale` |

**Publish order matters**: `@tokscale/core` → `@tokscale/cli` → `tokscale`

### 2.2 Version Bumping

Before publishing, bump the version in all three `package.json` files:

```bash
# Example: bump from 1.2.0 to 1.3.0
NEW_VERSION="1.3.0"

# Core
jq --arg v "$NEW_VERSION" '.version = $v' packages/core/package.json \
  > /tmp/core.json && mv /tmp/core.json packages/core/package.json

# CLI (version + dependency on core)
jq --arg v "$NEW_VERSION" \
  '.version = $v | .dependencies["@tokscale/core"] = $v' \
  packages/cli/package.json > /tmp/cli.json && mv /tmp/cli.json packages/cli/package.json

# Alias (version + dependency on cli)
jq --arg v "$NEW_VERSION" \
  '.version = $v | .dependencies["@tokscale/cli"] = $v' \
  packages/tokscale/package.json > /tmp/ts.json && mv /tmp/ts.json packages/tokscale/package.json
```

### 2.3 npm Login

```bash
npm login
# Or use a token:
export NPM_CONFIG_TOKEN=npm_xxxxx
```

### 2.4 Option A: Manual Publish (single platform only)

This only publishes the `.node` binary for your current platform. For full cross-platform support, use CI/CD.

```bash
# Step 1: Build & publish core
cd packages/core
npx napi build --platform --release
npm publish --access public

# Step 2: Build & publish CLI
cd ../cli
bun run build
npm publish --access public

# Step 3: Publish alias
cd ../tokscale
npm publish --access public
```

### 2.5 Option B: CI/CD Publish (recommended, all 8 platforms)

The project includes `.github/workflows/publish-cli.yml` that:

1. **Bumps versions** across all three packages (automatically or custom)
2. **Cross-compiles** Rust binaries for 8 platforms:
   - macOS (x64, ARM64)
   - Linux glibc (x64, ARM64)
   - Linux musl (x64, ARM64)
   - Windows (x64, ARM64)
3. **Publishes** in order: core → cli → tokscale
4. **Commits** the version bump back to the repo

**Setup (one-time)**:

1. Create an npm access token at https://www.npmjs.com/settings/tokens
2. Add it as a GitHub secret: **Settings → Secrets → Actions → `NPM_TOKEN`**

**Trigger a release**:

1. Go to **Actions → Publish** in your GitHub repo
2. Click **Run workflow**
3. Choose bump type:
   - `patch (x.x.X)` — bug fixes
   - `minor (x.X.0)` — new features
   - `major (X.0.0)` — breaking changes
4. Or enter a custom version like `2.0.0-beta.1`
5. Click **Run**

### 2.6 Verify Publication

```bash
# Check published versions
npm info @tokscale/core version
npm info @tokscale/cli version
npm info tokscale version

# Test immediately
bunx tokscale@latest
bunx tokscale@latest model-dates
bunx tokscale@latest --json
```

---

## Troubleshooting

### `napi: command not found`
```bash
bun install  # installs @napi-rs/cli as devDependency
```

### Rust build fails: `linker 'cc' not found`
```bash
# macOS
xcode-select --install

# Ubuntu/Debian
sudo apt install build-essential
```

### TUI doesn't start, falls back to `--light`
OpenTUI requires Bun runtime. Node.js is not supported for the TUI.
```bash
bun --version  # should be >= 1.0
```

### `dist/` is empty
```bash
cd packages/cli && bun run build
```
The `build:tui` step printing "TUI bundling skipped" is normal — TUI loads from `.tsx` source at runtime.

### npm publish `403 Forbidden`
```bash
npm whoami                          # verify you're logged in
npm access list @tokscale/core      # check package permissions
```

### AVA tests fail with `scanSessions is not a function`
These are pre-existing test failures referencing old API names. The current API uses two-phase processing (`parseLocalSources` / `finalizeReport`). Rust tests (150) pass completely.

---

## Quick Reference

```bash
# Local dev
bun install && bun run cli

# Build only
bun run build

# Test
cd packages/core && bun run test:all

# Manual publish (current platform only)
npm publish --access public   # from packages/core, then cli, then tokscale

# Full cross-platform publish
# → GitHub Actions → Publish workflow
```
