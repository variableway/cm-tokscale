# Agents.md — Tokscale 模块与 Agent 结构

> 本文档描述 Tokscale 项目中的核心模块（Agent）及其职责和交互关系。

## 核心 Agent

### 1. Scanner Agent (`scanner.rs`)
**职责**: 发现并收集所有 AI 编码助手的会话文件

- 并行扫描 9 种平台的本地文件目录
- 使用 `walkdir` 递归遍历 + `rayon` 并行加速
- 支持 headless 模式路径和自定义路径
- 输出: 按平台分类的文件路径列表 `ScanResult`

**交互**:
```
Scanner → Parser (传递文件路径给各平台 Parser)
```

### 2. Parser Agent (`sessions/*.rs`)
**职责**: 将各平台异构的会话文件解析为统一格式

- 每种平台有独立的 Parser 实现
- 统一输出 `UnifiedMessage` 格式
- 处理去重（Claude）、增量计算（Codex）、多格式适配（Gemini）等平台特有逻辑
- Agent 名称标准化（如 "OmO" → "Sisyphus"）

**Parser 列表**:
| Parser | 平台 | 特殊处理 |
|--------|------|----------|
| `opencode.rs` | OpenCode | Agent 映射 |
| `claudecode.rs` | Claude Code | 全局去重、headless |
| `codex.rs` | Codex CLI | 有状态模型追踪、增量 Token |
| `gemini.rs` | Gemini CLI | 多格式、thoughts 计数 |
| `cursor.rs` | Cursor IDE | CSV 解析、多账户 |
| `amp.rs` | Amp | 双数据源 |
| `droid.rs` | Droid | 模型名标准化 |
| `openclaw.rs` | OpenClaw | 两阶段解析 |
| `pi.rs` | Pi | 严格 JSONL header |

**交互**:
```
Scanner → Parser → Aggregator (传递 UnifiedMessage 列表)
```

### 3. Aggregator Agent (`aggregator.rs`)
**职责**: 将海量消息聚合为有意义的统计摘要

- Rayon 并行 map-reduce 聚合
- 按日期分组，计算每日 Token 分解和成本
- 计算强度等级 (0-4) 用于贡献热图着色
- 生成年度汇总

**交互**:
```
Parser → Aggregator → Pricing (传递聚合结果)
```

### 4. Pricing Agent (`pricing/`)
**职责**: 为每个模型获取实时定价并计算成本

- **LiteLLM 主源**: 从 LiteLLM 开源定价库获取
- **OpenRouter 备源**: 对 LiteLLM 未覆盖的新模型自动回退
- **Lookup 策略**: 7 步解析（精确匹配 → 别名 → 版本标准化 → 前缀 → 模糊 → 后缀剥离 → 前缀剥离）
- **缓存**: 1 小时 TTL 磁盘缓存
- **别名映射**: 如 `"big-pickle"` → `"glm-4.7"`

**交互**:
```
Aggregator → Pricing → 最终成本数据 → 输出层
```

## CLI Agent

### 5. Commander Agent (`cli.ts`)
**职责**: 用户交互入口，命令解析和路由

- Commander.js 定义所有子命令和选项
- 支持平台过滤、日期过滤、输出模式切换
- 动态加载 TUI（Bun 环境）或回退到表格模式

### 6. Native Bridge Agent (`native.ts` / `native-runner.ts`)
**职责**: TypeScript 与 Rust 核心的通信桥梁

- 子进程模式运行 Rust 核心
- JSON 序列化通信
- 超时和输出大小限制

### 7. TUI Agent (`tui/`)
**职责**: 交互式终端用户界面

- Solid.js + OpenTUI 实现
- 4 个视图: Overview / Models / Daily / Stats
- 键盘和鼠标交互
- 9 种颜色主题
- 自动刷新支持

### 8. Cursor Sync Agent (`cursor.ts`)
**职责**: Cursor IDE 使用数据同步

- Session Token 认证
- REST API 调用获取 CSV 使用数据
- 多账户管理和缓存
- 数据格式转换为 UnifiedMessage

### 9. Social Agent (`auth.ts` / `submit.ts`)
**职责**: 社交平台集成

- GitHub Device Flow OAuth
- 使用数据提交到排行榜
- API Token 管理

### 10. Wrapped Agent (`wrapped.ts`)
**职责**: 年度回顾图片生成

- @napi-rs/canvas 渲染 PNG
- 统计计算和排名
- 贡献图可视化

## Frontend Agent

### 11. Web Visualization Agent (`frontend/`)
**职责**: Web 端可视化和社交平台

- Next.js 16 + React 19
- 2D/3D 贡献图
- 排行榜和用户资料
- Drizzle ORM + Neon PostgreSQL

## Agent 交互总览

```
用户
 │
 ├─ CLI (Commander Agent)
 │   ├─ Native Bridge → Rust Core
 │   │   ├─ Scanner → Parsers → Aggregator → Pricing
 │   │   └─ 结果返回
 │   ├─ TUI Agent (渲染)
 │   ├─ Cursor Sync (API 同步)
 │   ├─ Social Agent (认证/提交)
 │   └─ Wrapped Agent (图片生成)
 │
 └─ Web (Frontend Agent)
     ├─ 排行榜 API
     ├─ 用户资料 API
     └─ 数据提交 API ← CLI Social Agent
```

## 数据流向

```
本地会话文件 ────┐
                 │
Cursor API ──────┤
                 ▼
            Scanner Agent
                 │
                 ▼
            Parser Agent(s)
                 │  UnifiedMessage
                 ▼
            Aggregator Agent
                 │  DailyContribution
                 ▼
            Pricing Agent
                 │  带成本的聚合数据
                 ▼
        ┌────────┴────────┐
        ▼                 ▼
    TUI / Table       JSON / Graph
        │                 │
        │            ┌────┴────┐
        │            ▼         ▼
        │        Frontend   Wrapped
        │
        └── Social Agent ──→ Frontend API
```
