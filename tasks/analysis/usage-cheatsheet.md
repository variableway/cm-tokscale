# Tokscale Usage Cheatsheet

## 安装 & 运行

```bash
# 快速运行（无需安装）
bunx tokscale@latest

# 轻量模式（无 TUI，仅表格）
bunx tokscale@latest --light

# 本地开发
bun install && bun run cli
```

## 基本命令

```bash
tokscale              # 启动交互式 TUI（默认）
tokscale --light      # 表格模式
tokscale --json       # JSON 输出
tokscale models       # 按模型报告
tokscale model-dates  # 按模型×日期报告
tokscale monthly      # 按月报告
tokscale graph        # 导出图表 JSON
tokscale tui          # 显式 TUI
tokscale sources      # 查看扫描位置
```

## 平台过滤

```bash
tokscale --opencode           # 仅 OpenCode
tokscale --claude             # 仅 Claude Code
tokscale --codex              # 仅 Codex CLI
tokscale --gemini             # 仅 Gemini CLI
tokscale --cursor             # 仅 Cursor IDE（需先 cursor login）
tokscale --amp                # 仅 Amp
tokscale --droid              # 仅 Droid
tokscale --openclaw           # 仅 OpenClaw
tokscale --claude --codex     # 组合过滤
```

## 日期过滤

```bash
tokscale --today                         # 今天
tokscale --week                          # 最近 7 天
tokscale --month                         # 本月
tokscale --since 2024-01-01 --until 2024-12-31  # 自定义范围
tokscale --year 2024                     # 按年
tokscale models --week --claude --json   # 组合使用
```

## 定价查询

```bash
tokscale pricing "claude-3-5-sonnet-20241022"
tokscale pricing "gpt-4o"
tokscale pricing "grok-code"
tokscale pricing "grok-code" --provider openrouter   # 指定数据源
```

## Cursor IDE 集成

```bash
tokscale cursor login --name work       # 登录（需 Session Token）
tokscale cursor status                  # 检查认证状态
tokscale cursor accounts                # 列出账户
tokscale cursor switch work             # 切换活跃账户
tokscale cursor logout --name work      # 登出（保留历史）
tokscale cursor logout --name work --purge-cache  # 登出并删除缓存
tokscale cursor logout --all            # 全部登出
```

## 社交平台

```bash
tokscale login                # GitHub OAuth 登录
tokscale whoami               # 查看当前身份
tokscale submit               # 提交数据到排行榜
tokscale submit --dry-run     # 预览（不提交）
tokscale submit --opencode --claude --since 2024-01-01   # 带过滤提交
tokscale logout               # 登出
```

## 年度回顾

```bash
tokscale wrapped              # 生成本年度回顾图片
tokscale wrapped --year 2025  # 指定年份
```

## 图表导出

```bash
tokscale graph --output data.json                    # 导出到文件
tokscale graph --today --claude                      # 带过滤
tokscale graph --output data.json --benchmark        # 显示处理耗时
```

## 按模型×日期查看

```bash
tokscale model-dates                        # 所有模型的每日使用明细
tokscale model-dates gpt-5                  # 模糊匹配模型名
tokscale model-dates --json                 # JSON 输出
tokscale model-dates --week --claude        # 带日期和平台过滤
```

## 多机器数据合并

```bash
# 导出当前机器数据
tokscale export --output machine-work.json
tokscale export --output machine-work.json --machine-id "work-laptop"

# 在目标机器导入并合并
tokscale import machine-work.json
tokscale import machine-work.json --label "work-laptop"
tokscale import machine-work.json --dry-run    # 预览（不保存）
tokscale import machine-work.json --json       # JSON 输出合并摘要
```

## TUI 快捷键

| 键 | 功能 |
|----|------|
| `1-4` / `←→/Tab` | 切换视图 |
| `↑↓` | 列表导航 |
| `c/n/t` | 按 成本/名称/Token 排序 |
| `1-8` | 切换数据源 |
| `p` | 切换颜色主题（9 种） |
| `r` | 刷新数据 |
| `e` | 导出 JSON |
| `q` | 退出 |

## 性能选项

```bash
tokscale --benchmark                    # 显示处理时间
TOKSCALE_NATIVE_TIMEOUT_MS=600000 tokscale --json   # 增加超时
TOKSCALE_MAX_OUTPUT_BYTES=209715200 tokscale --json # 增加输出限制
```

## 配置文件

| 文件 | 用途 |
|------|------|
| `~/.config/tokscale/settings.json` | TUI 设置（主题、自动刷新等） |
| `~/.config/tokscale/cursor-credentials.json` | Cursor 账户凭据 |
| `~/.cache/tokscale/pricing-*.json` | 定价缓存（1 小时 TTL） |

## Headless 模式

```bash
# 推荐方式（自动捕获）
tokscale headless codex exec -m gpt-5 "implement feature"

# 手动重定向
codex exec --json "task" > ~/.config/tokscale/headless/codex/run.jsonl

# 自定义目录
export TOKSCALE_HEADLESS_DIR="$HOME/my-logs"
```

## 开发命令

```bash
bun run build                # 构建全部
bun run build:core           # 构建 Rust 模块
bun run build:core:debug     # Debug 模式构建
bun run cli                  # 开发模式运行
bun run dev:frontend         # 前端开发服务器

cd packages/core
bun run test:rust            # Rust 单元测试
bun run test                 # AVA 集成测试
bun run test:all             # 全部测试
bun run bench                # 性能基准测试
```
