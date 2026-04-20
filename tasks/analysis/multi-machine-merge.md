# 多机器数据合并分析报告

## 问题场景

一个开发者有多台机器（如工作电脑、家用电脑、服务器），各台机器上运行不同的 AI 编码助手，需要汇总所有机器的 Token 使用数据。

## 三种方案分析

### 方案 A: 聚合器模式（中心化服务器）

每台机器上的 CLI 定期提交数据到中心服务器，服务器负责合并。

**架构**:
```
机器A → tokscale submit → ┐
机器B → tokscale submit → 服务器（聚合器）→ 统一视图
机器C → tokscale submit → ┘
```

**优点**:
- 实时性好，提交即可查看
- 当前 `tokscale submit` 基础设施已存在
- 服务端已有 `mergeSourceBreakdowns` 合并逻辑
- 天然去重（服务端按用户+日期+来源合并）

**缺点**:
- 需要网络连接
- 需要服务器维护成本
- 数据隐私问题（部分用户不愿上传）

**当前基础设施评估**:
- `POST /api/submit` 已实现源级别合并
- `DailyBreakdown` 表已支持多来源存储
- **实现工作量: 小** — 主要增强是在提交时附加 `machineId` 标识

---

### 方案 B: 离线导出/导入模式

每台机器导出数据文件，传送到其他机器本地合并。

**架构**:
```
机器A → tokscale export > data-a.json
                              ↓ (手动传输)
机器B → tokscale import data-a.json → 本地合并数据 → tokscale 查看统一结果
```

**优点**:
- 不需要服务器
- 数据隐私保护好
- 实现简单

**缺点**:
- 实时性差，需要手动操作
- 需要定义合并策略（重叠数据如何处理）
- 多台机器时组合爆炸（N*(N-1)/2 次传输）

**当前基础设施评估**:
- `tokscale graph --output` 已有导出功能
- 但没有 import/merge 命令
- 本地缓存格式 `tui-data-cache.json` 已包含每日按模型分解数据
- **实现工作量: 中** — 需要新增 import 命令和合并逻辑

---

### 方案 C: Daemon + GitHub 同步模式

每台机器运行 Daemon 定期上传数据到 GitHub Gist/Repo，其他机器定时拉取合并。

**架构**:
```
机器A Daemon → push → GitHub Gist/Repo ← pull ← 机器B Daemon
                              ↑
                    tokscale merge --from-gist
```

**优点**:
- 自动化，无需手动操作
- 利用 GitHub 免费存储
- 版本控制和历史追踪

**缺点**:
- 实现复杂度最高
- 需要每台机器运行后台进程
- GitHub API 频率限制
- 数据安全依赖 GitHub 访问权限
- 跨平台 Daemon 实现难度大

**当前基础设施评估**:
- 没有任何 Daemon 基础设施
- 没有远程存储集成
- **实现工作量: 大**

---

## 建议方案: A + B 混合方案

**推荐**: 先实现方案 B（离线导出/导入），再增强方案 A（服务端多机器追踪）。

### 理由:

1. **方案 B 技术门槛最低**: 只需新增两个 CLI 命令 (`export`, `import`) 和一个合并函数
2. **立即满足需求**: 用户可以马上使用导出/导入功能
3. **渐进增强**: 后续可以添加 `--auto-sync` 选项连接到服务端
4. **复用现有数据格式**: `TokenContributionData` 已经是完美的导出/导入格式
5. **服务端已有合并逻辑**: `mergeSourceBreakdowns` 可以复用到本地合并

### Phase 1: 离线导出/导入

```bash
# 导出当前机器的数据
tokscale export --output machine-work.json

# 在目标机器导入并合并
tokscale import machine-work.json

# 导入时指定来源标签
tokscale import machine-work.json --label "work-laptop"
```

**合并策略**: 按 `(date, source, model)` 三元组合并
- 如果同一天同一来源同一模型在多台机器出现，取 Token 总和
- 使用 session_id 去重

### Phase 2: 服务端增强

```bash
# 多机器自动提交
tokscale submit --machine-id "work-laptop"
tokscale submit --machine-id "home-desktop"

# 服务端按 machine-id 分组显示
```

**服务端增强**: 在 DailyBreakdown 表增加 `machine_id` 字段

### 实现路径

#### Phase 1 实现计划

**新增文件**:
- `packages/cli/src/merge.ts` — 合并逻辑

**修改文件**:
- `packages/cli/src/cli.ts` — 添加 `export` 和 `import` 命令
- `packages/cli/src/native.ts` — 暴露合并所需的接口

**合并函数核心逻辑**:
```typescript
function mergeContributions(
  local: DailyContribution[],
  imported: DailyContribution[]
): DailyContribution[] {
  const merged = new Map<string, DailyContribution>();

  // 插入本地数据
  for (const c of local) {
    merged.set(c.date, c);
  }

  // 合并导入数据
  for (const c of imported) {
    const existing = merged.get(c.date);
    if (existing) {
      // 合并 sources 数组，按 source+model 去重后累加
      existing.sources = mergeSources(existing.sources, c.sources);
      existing.totals.tokens += c.totals.tokens;
      existing.totals.cost += c.totals.cost;
      existing.totals.messages += c.totals.messages;
    } else {
      merged.set(c.date, c);
    }
  }

  return Array.from(merged.values()).sort((a, b) => a.date.localeCompare(b.date));
}
```

**数据去重策略**: 使用 `session_id` 作为去重键（每个 UnifiedMessage 已包含此字段），合并时过滤掉重复的 session。

#### 验证方式

1. 在两台机器上分别运行 `tokscale export --output a.json` 和 `tokscale export --output b.json`
2. 在任一机器上运行 `tokscale import b.json`
3. 运行 `tokscale` 查看，数据应包含两台机器的合并结果
4. 确认无重复数据（相同 session_id 不应重复计算）
