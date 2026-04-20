import { For, createMemo } from "solid-js";
import type { DailyModelBreakdown } from "../types/index.js";
import { getModelColor } from "../utils/colors.js";
import { formatTokensCompact, formatCostFull } from "../utils/format.js";

const DATE_COL_WIDTH = 14;
const INPUT_COL_WIDTH = 12;
const OUTPUT_COL_WIDTH = 12;
const CACHE_READ_COL_WIDTH = 10;
const TOTAL_COL_WIDTH = 14;
const COST_COL_WIDTH = 12;

interface ModelDailyEntry {
  date: string;
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  total: number;
  cost: number;
  messages: number;
}

interface ModelDateBreakdownPanelProps {
  modelId: string;
  dailyBreakdowns: Map<string, DailyModelBreakdown>;
  isNarrow: boolean;
  height: number;
}

export function ModelDateBreakdownPanel(props: ModelDateBreakdownPanelProps) {
  const modelDailyEntries = createMemo(() => {
    const entries: ModelDailyEntry[] = [];

    for (const [date, breakdown] of props.dailyBreakdowns) {
      for (const model of breakdown.models) {
        if (model.modelId === props.modelId) {
          entries.push({
            date,
            input: model.tokens.input,
            output: model.tokens.output,
            cacheRead: model.tokens.cacheRead,
            cacheWrite: model.tokens.cacheWrite,
            total: model.tokens.input + model.tokens.output + model.tokens.cacheRead + model.tokens.cacheWrite,
            cost: model.cost,
            messages: model.messages,
          });
        }
      }
    }

    return entries.sort((a, b) => b.date.localeCompare(a.date));
  });

  const totals = createMemo(() => {
    const entries = modelDailyEntries();
    return entries.reduce(
      (acc, e) => ({
        input: acc.input + e.input,
        output: acc.output + e.output,
        cacheRead: acc.cacheRead + e.cacheRead,
        cacheWrite: acc.cacheWrite + e.cacheWrite,
        total: acc.total + e.total,
        cost: acc.cost + e.cost,
        messages: acc.messages + e.messages,
      }),
      { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0, cost: 0, messages: 0 }
    );
  });

  const visibleEntries = createMemo(() => {
    const maxRows = Math.max(props.height - 4, 0);
    return modelDailyEntries().slice(0, maxRows);
  });

  const renderHeader = () => {
    if (props.isNarrow) {
      return `${"Date".padEnd(DATE_COL_WIDTH)}${"Total".padStart(TOTAL_COL_WIDTH)}${"Cost".padStart(COST_COL_WIDTH)}`;
    }
    return `${"Date".padEnd(DATE_COL_WIDTH)}${"Input".padStart(INPUT_COL_WIDTH)}${"Output".padStart(OUTPUT_COL_WIDTH)}${"C.Read".padStart(CACHE_READ_COL_WIDTH)}${"Total".padStart(TOTAL_COL_WIDTH)}${"Cost".padStart(COST_COL_WIDTH)}`;
  };

  const renderRow = (entry: ModelDailyEntry) => {
    const input = formatTokensCompact(entry.input);
    const output = formatTokensCompact(entry.output);
    const cacheRead = formatTokensCompact(entry.cacheRead);
    const total = formatTokensCompact(entry.total);
    const cost = formatCostFull(entry.cost);

    if (props.isNarrow) {
      return `${entry.date.padEnd(DATE_COL_WIDTH)}${total.padStart(TOTAL_COL_WIDTH)}`;
    }
    return `${entry.date.padEnd(DATE_COL_WIDTH)}${input.padStart(INPUT_COL_WIDTH)}${output.padStart(OUTPUT_COL_WIDTH)}${cacheRead.padStart(CACHE_READ_COL_WIDTH)}${total.padStart(TOTAL_COL_WIDTH)}`;
  };

  const renderTotalRow = () => {
    const t = totals();
    const total = formatTokensCompact(t.total);
    const cost = formatCostFull(t.cost);

    if (props.isNarrow) {
      return `${"TOTAL".padEnd(DATE_COL_WIDTH)}${total.padStart(TOTAL_COL_WIDTH)}`;
    }
    const input = formatTokensCompact(t.input);
    const output = formatTokensCompact(t.output);
    const cacheRead = formatTokensCompact(t.cacheRead);
    return `${"TOTAL".padEnd(DATE_COL_WIDTH)}${input.padStart(INPUT_COL_WIDTH)}${output.padStart(OUTPUT_COL_WIDTH)}${cacheRead.padStart(CACHE_READ_COL_WIDTH)}${total.padStart(TOTAL_COL_WIDTH)}`;
  };

  const renderTotalCost = () => formatCostFull(totals().cost);

  return (
    <box flexDirection="column">
      <box flexDirection="row">
        <text fg="cyan" bold>{renderHeader()}</text>
      </box>

      <For each={visibleEntries()}>
        {(entry, i) => (
          <box flexDirection="row">
            <text>{renderRow(entry)}</text>
            <text fg="green">{formatCostFull(entry.cost).padStart(COST_COL_WIDTH)}</text>
          </box>
        )}
      </For>

      <box flexDirection="row">
        <text fg="white" bold>{renderTotalRow()}</text>
        <text fg="green" bold>{renderTotalCost().padStart(COST_COL_WIDTH)}</text>
      </box>

      <box flexDirection="row" marginTop={1}>
        <text dim>{`${modelDailyEntries().length} days • ${totals().messages.toLocaleString()} messages`}</text>
      </box>
    </box>
  );
}
