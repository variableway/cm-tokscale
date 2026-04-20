# Tokscale 项目架构分析

## 项目概述

Tokscale 是一个跨平台 AI 编码助手 Token 使用量和成本追踪工具，包含 CLI、TUI 和 Web 可视化三层呈现。采用 Monorepo 结构，核心计算由 Rust 实现，通过 napi-rs 绑定到 Node.js。

## 技术栈

| 层级 | 技术 |
|------|------|
| 包管理/运行时 | Bun (npm workspaces) |
| 核心计算 | Rust + napi-rs + rayon + simd-json |
| CLI | TypeScript + Commander.js |
| TUI | Solid.js + OpenTUI (Zig 原生渲染) |
| Web 前端 | Next.js 16 + React 19 + Drizzle ORM + Neon PostgreSQL |
| 测试 | Cargo test + AVA (Node.js) + Vitest (Frontend) |

## Monorepo 结构

```
packages/
├── core/         # Rust 原生模块 - 高性能文件扫描、解析、聚合
├── cli/          # TypeScript CLI - 命令行入口、表格渲染、TUI
├── frontend/     # Next.js Web 应用 - 可视化图表、排行榜
├── tokscale/     # 别名包，依赖 @tokscale/cli
└── benchmarks/   # 性能基准测试
```

## 核心数据流

```
[本地文件系统]  [Cursor API]
      │              │
      ▼              ▼
  scanner.rs    cursor.ts (TS)
      │              │
      ▼              │
  sessions/*.rs      │   ← 各平台 Parser 转换为 UnifiedMessage
      │              │
      ▼              ▼
  aggregator.rs  ← 合并 Cursor 数据 (Phase 2)
      │
      ▼
  pricing/       ← LiteLLM + OpenRouter 实时定价
      │
      ▼
  输出: TUI / Table / JSON / Graph Data
```

### 两阶段处理架构

1. **Phase 1 (Rust)**: 并行扫描本地文件 → 各平台 Parser → UnifiedMessage 列表
2. **Phase 2 (Rust/TS)**: 合并 Cursor API 数据 → 应用定价 → 生成报告/图表

Native core 以**子进程**方式运行（非 in-process），通过 JSON stdin/stdout 通信。

## 支持的 AI 平台及数据路径

| 平台 | 数据路径 | 文件格式 | Parser |
|------|----------|----------|--------|
| OpenCode | `~/.local/share/opencode/storage/message/` | JSON | `opencode.rs` |
| Claude Code | `~/.claude/projects/` | JSONL | `claudecode.rs` |
| Codex CLI | `~/.codex/sessions/` | JSONL | `codex.rs` |
| Gemini CLI | `~/.gemini/tmp/*/chats/` | JSON | `gemini.rs` |
| Cursor IDE | API 同步到 `~/.config/tokscale/cursor-cache/` | CSV | `cursor.rs` |
| Amp | `~/.local/share/amp/threads/` | JSON | `amp.rs` |
| Droid | `~/.factory/sessions/` | JSON/JSONL | `droid.rs` |
| OpenClaw | `~/.openclaw/agents/` | JSON + JSONL | `openclaw.rs` |
| Pi | `~/.pi/agent/sessions/` | JSONL | `pi.rs` |

## 模块间交互方式

### Rust Core ↔ CLI (TypeScript)

```
cli.ts → native.ts → native-runner.ts (子进程) → Rust lib.rs
                                                   ↓
                                              scanner.rs
                                                   ↓
                                              sessions/*.rs
                                                   ↓
                                              aggregator.rs
                                                   ↓
                                              pricing/*
                                                   ↓
                                            JSON stdout → native.ts → cli.ts
```

- **通信方式**: CLI 写临时 JSON 文件 → 子进程读取 → 调用 Rust 函数 → JSON stdout 返回
- **超时控制**: `TOKSCALE_NATIVE_TIMEOUT_MS` (默认 5 分钟)
- **输出限制**: `TOKSCALE_MAX_OUTPUT_BYTES` (默认 100MB)

### CLI ↔ Cursor API

```
cli.ts → cursor.ts → Cursor REST API → CSV 数据 → cursor.rs Parser
```

- **认证**: Session Token 存储于 `~/.config/tokscale/cursor-credentials.json`
- **缓存**: 多账户支持，数据缓存于 `~/.config/tokscale/cursor-cache/`

### CLI ↔ Social Platform

```
cli.ts → auth.ts → GitHub OAuth (Device Flow) → API Token
cli.ts → submit.ts → /api/submit → PostgreSQL (via Frontend API)
```

### Frontend ↔ Database

```
Next.js API Routes → Drizzle ORM → Neon PostgreSQL
                     ↑
          /api/submit (CLI 提交)
          /api/leaderboard (排行榜查询)
          /api/users/[username] (用户数据)
```

## 关键设计决策

1. **子进程模式**: Rust core 以子进程运行，避免阻塞 UI 线程
2. **SIMD JSON**: 使用 `simd-json` 加速 JSON 解析，约 8x 提升
3. **并行聚合**: Rayon 实现并行 map-reduce 聚合
4. **双定价源**: LiteLLM 主源 + OpenRouter 备源，1 小时磁盘缓存
5. **两阶段处理**: 本地解析先完成，Cursor API 数据后合并，支持增量更新
