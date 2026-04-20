# 各模块详细逻辑分析

## 1. Rust Core (`packages/core/`)

### 1.1 lib.rs — NAPI 入口

导出给 Node.js 的核心函数：

| 函数 | 功能 | 输入 | 输出 |
|------|------|------|------|
| `version()` | 返回模块版本 | - | `string` |
| `health_check()` | 健康检查 | - | `boolean` |
| `parse_local_sources()` | 解析本地会话文件 | 扫描配置 | `Vec<ParsedMessage>` |
| `finalize_report()` | 合并数据 + 定价，生成报告 | 本地消息 + Cursor 数据 | `ModelReport` |
| `get_model_report()` | 按模型聚合报告 | 消息列表 | `ModelReport` |
| `get_monthly_report()` | 按月聚合报告 | 消息列表 | `MonthlyReport` |
| `generate_graph_with_pricing()` | 生成图表数据 | 消息列表 | `GraphResult` |
| `finalize_report_and_graph()` | 报告 + 图表合并 | 全部数据 | `(Report, Graph)` |
| `lookup_pricing()` | 查询模型定价 | 模型名 | `PricingInfo` |

### 1.2 scanner.rs — 文件扫描

**核心逻辑**:
1. 定义 `SessionType` 枚举，对应每种 AI 平台
2. 对每种平台，构建其特有的目录路径和文件匹配模式
3. 使用 `walkdir` 遍历目录，`rayon` 并行扫描多个平台
4. 支持 headless 模式路径（通过 `TOKSCALE_HEADLESS_DIR` 环境变量）
5. 过滤掉 archive 目录和备份文件

**关键数据结构**:
```rust
struct ScanResult {
    opencode: Vec<PathBuf>,
    claude: Vec<PathBuf>,
    codex: Vec<PathBuf>,
    gemini: Vec<PathBuf>,
    cursor: Vec<PathBuf>,
    amp: Vec<PathBuf>,
    droid: Vec<PathBuf>,
    openclaw: Vec<PathBuf>,
    pi: Vec<PathBuf>,
}
```

### 1.3 sessions/*.rs — 各平台 Parser

**统一输出**: `UnifiedMessage`
```rust
struct UnifiedMessage {
    source: String,           // "opencode", "claude", ...
    model_id: String,         // 模型标识
    provider_id: String,      // 提供商
    session_id: String,       // 会话 ID
    timestamp: i64,           // Unix 毫秒
    date: String,             // YYYY-MM-DD
    tokens: TokenBreakdown,   // 各类 token 计数
    cost: f64,                // 计算成本
    agent: Option<String>,    // Agent 名称
    dedup_key: Option<String>,// 去重键
}
```

#### OpenCode Parser (`opencode.rs`)
- 读取单个 JSON 文件
- 仅处理 `role: "assistant"` 消息
- 从嵌套结构提取 token breakdown
- Agent 名称映射（如 "OmO" → "Sisyphus"）
- 负值 token 安全钳位

#### Claude Code Parser (`claudecode.rs`)
- 读取 JSONL 文件
- **全局去重**: 使用 `message_id:request_id` 哈希
- 支持 headless 模式（不同格式）
- 流式处理大文件
- 回退到文件修改时间作为时间戳

#### Codex Parser (`codex.rs`)
- 读取 JSONL 文件，**有状态解析**
- 跟踪当前会话使用的模型
- 检测 headless exec 会话
- **增量计算**: 从累计 token 总量计算 delta
- 处理缓存 token 语义（OpenAI 包含 cached 在 input 中）

#### Gemini Parser (`gemini.rs`)
- 支持多种格式（结构化 session、headless JSON、JSONL）
- thoughts 计为 reasoning tokens
- 从各种嵌套位置提取统计信息

#### Cursor Parser (`cursor.rs`)
- 解析 CSV 文件
- 检测新旧 CSV 格式
- 处理多账户文件 (`usage.<account>.csv`)
- 从模型名推断 provider
- Token 计算: `cache_write = input_with_cache - input_without_cache`

#### Amp Parser (`amp.rs`)
- 双数据源: 优先 `usageLedger.events`（聚合），回退到单条消息
- 从模型名模式推断 provider

#### Droid Parser (`droid.rs`)
- 复杂模型名标准化：去除 "custom:" 前缀、括号标注、点号转换
- 回退到从 JSONL 内容提取模型名

#### OpenClaw Parser (`openclaw.rs`)
- **两阶段解析**: 先解析 sessions.json 索引，再解析各 session 文件
- 跟踪会话内 model 和 provider 变更

#### Pi Parser (`pi.rs`)
- JSONL 格式，首行必须是 session header
- 仅处理 assistant 消息
- 简单直接的字段映射

### 1.4 aggregator.rs — 聚合管道

**处理流程**:
1. 接收 `Vec<UnifiedMessage>`
2. Rayon 并行 fold/reduce，按日期分组
3. 每日累计 `DayAccumulator` → `DailyContribution`
4. 计算强度等级 (0-4)，基于成本相对于最大值的比例
5. 生成年度摘要 `YearAccumulator`
6. 输出 `GraphResult` 含元数据

### 1.5 pricing/ — 定价模块

#### lookup.rs — 多策略查询
```
1. 精确匹配 → 2. 版本标准化 (4-5→4.5) → 3. 模型名标准化
→ 4. Provider 前缀匹配 → 5. 模糊匹配 → 6. 后缀剥离 (tier 变体)
→ 7. 前缀剥离 (路由前缀)
```
优先选择原始提供商（如 `xai/`）而非转售商（如 `azure_ai/`）

#### aliases.rs — 模型别名映射
- `"big-pickle"` → `"glm-4.7"`
- `"k2p5"` → `"kimi-k2-thinking"`

#### cache.rs — 磁盘缓存
- XDG 缓存目录 (`~/.cache/tokscale/`)
- 1 小时 TTL
- 原子写入（临时文件 + rename）

---

## 2. CLI (`packages/cli/`)

### 2.1 cli.ts — 命令入口

使用 Commander.js 定义所有子命令：

| 命令 | 功能 |
|------|------|
| `tokscale` (默认) | 启动 TUI 或 --light 表格模式 |
| `tokscale models` | 按模型查看使用报告 |
| `tokscale monthly` | 按月查看使用报告 |
| `tokscale graph` | 导出贡献图表 JSON |
| `tokscale tui` | 显式启动 TUI |
| `tokscale pricing <model>` | 查询模型定价 |
| `tokscale login/logout/whoami` | 社交平台认证 |
| `tokscale submit` | 提交数据到排行榜 |
| `tokscale wrapped` | 生成年度回顾图片 |
| `tokscale cursor login/status/accounts/switch/logout` | Cursor 集成 |
| `tokscale sources` | 显示扫描位置信息 |
| `tokscale headless` | Headless 模式执行 |

**过滤选项**: `--opencode`, `--claude`, `--codex`, `--gemini`, `--cursor`, `--amp`, `--droid`, `--openclaw`
**日期过滤**: `--today`, `--week`, `--month`, `--since`, `--until`, `--year`

### 2.2 native.ts / native-runner.ts — Rust 调用桥接

**native.ts**: TypeScript 封装
- 定义与 Rust 导出匹配的接口
- 提供 `runInSubprocess()` 辅助函数
- 暴露异步函数给主应用

**native-runner.ts**: 独立子进程
- 从临时文件读取 JSON 输入
- 直接调用 Rust 函数
- 通过 stdout 返回结果

### 2.3 tui/ — 终端 UI

Solid.js + OpenTUI 实现的交互式 TUI：

**核心状态管理** (App.tsx):
- activeTab: 当前标签页
- sources: 已启用的数据源
- sorting: 排序方式 (cost/name/tokens)

**四个视图**:
1. `OverviewView`: Token 图表 + Top 模型
2. `ModelView`: 逐模型详细分解
3. `DailyView`: 每日使用时间线
4. `StatsView`: 使用统计 + 贡献图

**数据加载** (useData.ts):
- 集中式数据加载和缓存
- 两阶段处理 (parse + finalize)
- 缓存失效逻辑

### 2.4 cursor.ts — Cursor 集成

**认证流程**:
1. 用户粘贴 cursor.com 的 Session Token
2. 通过 API 调用验证 Token
3. 凭据存储，支持多账户标签

**数据同步**:
1. 调用 Cursor API 下载 CSV 使用数据
2. 解析并缓存到 `~/.config/tokscale/cursor-cache/`
3. 默认聚合所有账户数据

### 2.5 auth.ts / submit.ts — 社交平台

**认证**: GitHub Device Flow OAuth
**提交**: 聚合数据 → 显示摘要 → POST 到 `/api/submit`

### 2.6 wrapped.ts — 年度回顾

使用 `@napi-rs/canvas` 渲染 PNG 图片：
- Top 模型 / Top 客户端
- 总 Token、成本、活跃天数、连续使用天数
- 贡献图

---

## 3. Frontend (`packages/frontend/`)

### 3.1 架构

Next.js 16 App Router + React 19 + Styled Components

### 3.2 核心页面

| 路由 | 功能 |
|------|------|
| `/` | 排行榜首页 |
| `/u/[username]` | 用户 Token 图表 |
| `/settings` | API Token 管理 |

### 3.3 API 路由

| 路由 | 功能 |
|------|------|
| `/api/auth/github/*` | GitHub OAuth |
| `/api/auth/device/*` | Device Code Flow |
| `/api/auth/session` | Session 管理 |
| `/api/leaderboard` | 排行榜数据 |
| `/api/submit` | 数据提交 |
| `/api/users/[username]` | 用户资料 |

### 3.4 数据库 Schema (Drizzle ORM)

| 表 | 用途 |
|----|------|
| Users | GitHub 集成、用户资料 |
| Sessions | 认证会话 |
| ApiTokens | CLI 认证令牌 |
| Submissions | 用户 Token 使用总计 |
| DailyBreakdown | 每日 Token 分解（含 source/model/provider JSON 字段）|
| DeviceCodes | OAuth Device Flow |

### 3.5 组件

- `TokenGraph2D`: GitHub 风格贡献热图
- `TokenGraph3D`: 等距立方体可视化
- `BlackholeHero`: 首页 Hero 区域
- `StatsPanel`: 用户统计
- `BreakdownPanel`: 详细 Token 分解
