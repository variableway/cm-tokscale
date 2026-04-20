# TUI 交互接口规范

## 组件交互接口

### 1. App ↔ useData Hook

**调用**: App 通过 `useData()` 获取数据
**输入**: `enabledSources` (Signal), `dateFilters` (可选)
**输出**: `data`, `loading`, `error`, `refresh()`, `loadingPhase`, `isRefreshing`

**触发刷新**:
- 用户按 `r` 键 → `refresh()`
- 自动刷新定时器 → `refresh()`
- 数据源切换 → 自动重载

### 2. App → Header

**数据流**: 下行
```
activeTab → Header (高亮当前标签)
```
**回调**:
```
onTabClick(tab: TabType) → App.setActiveTab(tab)
```

### 3. App → Footer

**数据流**: 双向
```
下行:
  enabledSources → SourceBadge 显示
  sortBy → SortButton 高亮
  totals → 总计显示
  colorPalette → 主题标识
  statusMessage → 状态消息

上行回调:
  onSourceToggle(source) → 切换数据源
  onSortChange(sort) → 切换排序
  onPaletteChange() → 循环主题
  onRefresh() → 手动刷新
```

### 4. App → View Components

**数据流**: 下行
```
data: TUIData → 各视图组件
sortBy, sortDesc → 排序控制
selectedIndex → 列表选中项
scrollOffset → 滚动位置
height, width → 布局尺寸
```

### 5. StatsView ↔ DateBreakdownPanel

**数据流**: 双向
```
下行:
  data.contributions → 贡献热图渲染
  selectedDate → 选中日期

上行回调:
  onSelectDate(date) → 显示该日详情
```

---

## 键盘交互映射

| 键 | 上下文 | 行为 | 状态变更 |
|----|--------|------|----------|
| `1-4` | 全局 | 切换视图 | `setActiveTab()` |
| `←/→` | 全局 | 切换视图 | `setActiveTab()` |
| `Tab` | 全局 | 下一个视图 | `setActiveTab()` |
| `↑/↓` | 列表视图 | 上下导航 | `setSelectedIndex()` |
| `c` | 全局 | 按成本排序 | `setSortBy("cost")` |
| `n` | 全局 | 按名称排序 | `setSortBy("tokens")` |
| `t` | 全局 | 按 Token 排序 | `setSortBy("tokens")` |
| `1-8` | 全局 | 切换数据源 | `setEnabledSources()` |
| `p` | 全局 | 切换主题 | `setColorPalette()` |
| `r` | 全局 | 刷新数据 | `refresh()` |
| `e` | 全局 | 导出 JSON | 文件保存 |
| `q` | 全局 | 退出 | 进程终止 |

---

## 数据源切换逻辑

```typescript
// 8 个数据源对应数字键 1-8
const SOURCE_ORDER: SourceType[] = [
  "opencode",  // 1
  "claude",    // 2
  "codex",     // 3
  "cursor",    // 4
  "gemini",    // 5
  "amp",       // 6
  "droid",     // 7
  "openclaw",  // 8
];

// 切换：添加或移除源
function toggleSource(source: SourceType) {
  const sources = new Set(enabledSources());
  if (sources.has(source)) {
    sources.delete(source);
  } else {
    sources.add(source);
  }
  setEnabledSources(sources);
  // 触发 useData 重新计算
}
```

---

## 主题系统

### 9 种颜色主题
```typescript
type ColorPaletteName =
  | "green"       // 经典绿色
  | "halloween"   // 万圣节橙/紫
  | "teal"        // 青色
  | "blue"        // 蓝色（默认）
  | "pink"        // 粉色
  | "purple"      // 紫色
  | "orange"      // 橙色
  | "monochrome"  // 单色灰
  | "ylgnbu";     // 黄-绿-蓝渐变
```

### 主题循环
```
按 p 键 → 按顺序切换下一个主题
当前主题 → 设置持久化到 ~/.config/tokscale/settings.json
```

---

## 加载状态机

```
idle → parsing-sources → loading-pricing → finalizing-report → complete
  ↑                                                            │
  └──────────────────── refresh() ─────────────────────────────┘
```

每个阶段对应不同的 UI 展示（Spinner 动画、进度提示）。

---

## 导出功能

### JSON 导出 (`e` 键)
```
当前 TUIData → TokenContributionData (graph-types.ts) → JSON 文件
```

导出内容包括：
- `meta`: 生成时间、版本、日期范围
- `summary`: 总计统计
- `years`: 年度汇总
- `contributions`: 每日贡献详情
