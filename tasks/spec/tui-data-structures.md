# TUI 数据结构与交互接口规范

## 1. 核心数据类型

### TokenBreakdown — Token 分解
```typescript
interface TokenBreakdown {
  input: number;       // 输入 token
  output: number;      // 输出 token
  cacheRead: number;   // 缓存读取 token
  cacheWrite: number;  // 缓存写入 token
  reasoning: number;   // 推理 token
}
```

### UnifiedMessage — 统一消息格式（所有 Parser 的输出）
```typescript
interface UnifiedMessage {
  source: SourceType;        // 来源平台
  modelId: string;           // 模型 ID
  providerId?: string;       // 提供商
  sessionId: string;         // 会话 ID
  timestamp: number;         // Unix 毫秒时间戳
  date: string;              // YYYY-MM-DD
  tokens: TokenBreakdown;    // Token 分解
  cost: number;              // 计算成本
  agent?: string;            // Agent 名称
}
```

### SourceType — 平台类型
```typescript
type SourceType = "opencode" | "claude" | "codex" | "gemini" | "cursor" | "amp" | "droid" | "openclaw";
```

---

## 2. 聚合数据结构

### ModelUsage — 模型使用量（Rust → TS）
```typescript
interface ModelUsage {
  source: string;       // 来源
  model: string;        // 模型名
  provider: string;     // 提供商
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  reasoning: number;
  messageCount: number;
  cost: number;
}
```

### MonthlyUsage — 月度使用量
```typescript
interface MonthlyUsage {
  month: string;            // YYYY-MM
  models: string[];         // 该月使用的模型列表
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  messageCount: number;
  cost: number;
}
```

### DailyContribution — 每日贡献
```typescript
interface DailyContribution {
  date: string;               // YYYY-MM-DD
  totals: {
    tokens: number;
    cost: number;
    messages: number;
  };
  intensity: 0 | 1 | 2 | 3 | 4;  // 强度等级
  tokenBreakdown: TokenBreakdown;
  sources: SourceContribution[];
}
```

### SourceContribution — 来源贡献
```typescript
interface SourceContribution {
  source: SourceType;
  modelId: string;
  providerId?: string;
  tokens: TokenBreakdown;
  cost: number;
  messages: number;
}
```

### GraphResult — 完整图表数据
```typescript
interface GraphResult {
  meta: {
    generatedAt: string;
    version: string;
    dateRange: { start: string; end: string };
    processingTimeMs: number;
  };
  summary: DataSummary;
  years: YearSummary[];
  contributions: DailyContribution[];
}
```

### DataSummary — 数据摘要
```typescript
interface DataSummary {
  totalTokens: number;
  totalCost: number;
  totalDays: number;
  activeDays: number;
  averagePerDay: number;
  maxCostInSingleDay: number;
  sources: string[];
  models: string[];
}
```

---

## 3. TUI 内部数据结构

### TUIData — TUI 核心数据容器
```typescript
interface TUIData {
  modelEntries: ModelEntry[];            // 模型列表
  dailyEntries: DailyEntry[];            // 每日列表
  contributions: ContributionDay[];      // 贡献热图数据
  contributionGrid: GridCell[][];        // 贡献图网格
  stats: Stats;                          // 统计信息
  totalCost: number;                     // 总成本
  totals: TotalBreakdown;                // 总 Token 分解
  modelCount: number;                    // 模型数量
  chartData: ChartDataPoint[];           // 图表数据点
  topModels: ModelWithPercentage[];      // Top 模型（含百分比）
  dailyBreakdowns: Map<string, DailyModelBreakdown>;  // 每日模型分解
}
```

### TUI 视图数据类型

#### ModelEntry — 模型视图条目
```typescript
interface ModelEntry {
  source: string;
  model: string;
  input: number;
  output: number;
  cacheWrite: number;
  cacheRead: number;
  reasoning: number;
  total: number;
  cost: number;
}
```

#### DailyEntry — 每日视图条目
```typescript
interface DailyEntry {
  date: string;
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  total: number;
  cost: number;
}
```

#### ContributionDay — 贡献图单日
```typescript
interface ContributionDay {
  date: string;
  cost: number;
  tokens: number;
  level: number;  // 0-4
}
```

#### ChartDataPoint — 图表数据点
```typescript
interface ChartDataPoint {
  date: string;
  models: Array<{
    modelId: string;
    tokens: number;
    color: string;
  }>;
  total: number;
}
```

#### Stats — 统计面板
```typescript
interface Stats {
  favoriteModel: string;
  totalTokens: number;
  sessions: number;
  longestSession: string;
  currentStreak: number;
  longestStreak: number;
  activeDays: number;
  totalDays: number;
  peakHour: string;
}
```

---

## 4. TUI 组件接口（Props）

### App — 根组件
```typescript
interface AppProps {
  initialTab?: TabType;            // 初始标签页
  enabledSources?: SourceType[];   // 启用的数据源
  sortBy?: SortType;               // 排序方式
  sortDesc?: boolean;              // 降序
  since?: string;                  // 开始日期
  until?: string;                  // 结束日期
  year?: string;                   // 年份
  colorPalette?: ColorPaletteName; // 颜色主题
}

type TabType = "overview" | "model" | "daily" | "stats";
type SortType = "cost" | "tokens" | "date";
type ColorPaletteName = "green" | "halloween" | "teal" | "blue" | "pink" | "purple" | "orange" | "monochrome" | "ylgnbu";
```

### Header — 头部导航
```typescript
interface HeaderProps {
  activeTab: TabType;
  onTabClick?: (tab: TabType) => void;
  width?: number;
}
```

### Footer — 底部状态栏
```typescript
interface FooterProps {
  enabledSources: Set<SourceType>;
  sortBy: SortType;
  totals?: TotalBreakdown;
  modelCount: number;
  activeTab: TabType;
  colorPalette: ColorPaletteName;
  statusMessage?: string | null;
  isRefreshing?: boolean;
  loadingPhase?: LoadingPhase;
  autoRefreshEnabled?: boolean;
  autoRefreshMs?: number;
  width?: number;
  onSourceToggle?: (source: SourceType) => void;
  onSortChange?: (sort: SortType) => void;
  onPaletteChange?: () => void;
  onRefresh?: () => void;
}
```

### OverviewView / ModelView / DailyView
```typescript
interface ViewProps {
  data: TUIData;
  sortBy: SortType;
  sortDesc: boolean;
  selectedIndex: Accessor<number>;
  scrollOffset: Accessor<number>;
  height: number;
  width: number;
}
```

### BarChart — 柱状图
```typescript
interface BarChartProps {
  data: ChartDataPoint[];
  width: number;
  height: number;
}
```

### DateBreakdownPanel — 日期详情面板
```typescript
interface DateBreakdownPanelProps {
  data: TUIData;
  selectedDate?: string | null;
  onSelectDate?: (date: string | null) => void;
  width?: number;
}
```

---

## 5. 状态管理（Solid.js Signals）

### App 全局状态
```typescript
// 导航状态
const [activeTab, setActiveTab] = createSignal<TabType>("overview");
const [selectedIndex, setSelectedIndex] = createSignal<number>(0);
const [scrollOffset, setScrollOffset] = createSignal<number>(0);

// 过滤/排序状态
const [enabledSources, setEnabledSources] = createSignal<Set<SourceType>>(new Set(ALL_SOURCES));
const [sortBy, setSortBy] = createSignal<SortType>("tokens");
const [sortDesc, setSortDesc] = createSignal<boolean>(true);

// 显示状态
const [colorPalette, setColorPalette] = createSignal<ColorPaletteName>(DEFAULT_PALETTE);
const [selectedDate, setSelectedDate] = createSignal<string | null>(null);
const [statusMessage, setStatusMessage] = createSignal<string | null>(null);

// 自动刷新
const [autoRefreshEnabled, setAutoRefreshEnabled] = createSignal<boolean>(false);
const [autoRefreshMs, setAutoRefreshMs] = createSignal<number>(60000);
```

### 数据加载状态
```typescript
type LoadingPhase =
  | "idle"
  | "parsing-sources"
  | "loading-pricing"
  | "finalizing-report"
  | "complete";
```

### useData Hook 接口
```typescript
function useData(
  enabledSources: Accessor<Set<SourceType>>,
  dateFilters?: DateFilters
): {
  data: Accessor<TUIData | null>;
  loading: Accessor<boolean>;
  error: Accessor<string | null>;
  refresh: () => void;
  loadingPhase: Accessor<LoadingPhase>;
  isRefreshing: Accessor<boolean>;
}
```

---

## 6. 组件层次与数据流

```
App (全局状态管理)
├── useData Hook (数据加载/缓存)
│   └── Rust Native (解析/聚合/定价)
├── Header (标签页导航)
├── Main Content Area
│   ├── OverviewView ─── BarChart + Top Models
│   ├── ModelView ────── ModelRow 列表
│   ├── DailyView ────── DailyEntry 列表
│   └── StatsView ────── Contribution Grid + DateBreakdownPanel
└── Footer (数据源切换/排序/主题)
```

### 数据转换链
```
Raw Session Files
  → UnifiedMessage (Parser 标准化)
  → ModelUsage / DailyContribution (Rust 聚合)
  → ModelEntry / DailyEntry (TUI 格式化)
  → ChartDataPoint (图表渲染)
```

---

## 7. 布局常量

```typescript
const LAYOUT = {
  HEADER_HEIGHT: 1,
  FOOTER_HEIGHT: 3,
  MIN_CONTENT_HEIGHT: 12,
  CHART_HEIGHT_RATIO: 0.35,
  MIN_CHART_HEIGHT: 5,
  MIN_LIST_HEIGHT: 4,
  CHART_AXIS_WIDTH: 8,
  MIN_CHART_WIDTH: 20,
  MAX_VISIBLE_BARS: 52,
} as const;
```

---

## 8. TUI 入口函数

```typescript
// 启动 TUI
export async function launchTUI(options?: TUIOptions): Promise<void>

interface TUIOptions {
  initialTab?: TabType;
  enabledSources?: SourceType[];
  sortBy?: SortType;
  sortDesc?: boolean;
  since?: string;
  until?: string;
  year?: string;
  colorPalette?: ColorPaletteName;
}
```
