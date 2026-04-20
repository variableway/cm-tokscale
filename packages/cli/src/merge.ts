/**
 * Merge logic for combining token usage data from multiple machines.
 *
 * Strategy: merge by (date, source, model_id, provider_id) tuple.
 * When duplicates are found, sum token counts and costs.
 */

import type {
  TokenContributionData,
  DailyContribution,
  SourceContribution,
  TokenBreakdown,
} from "./graph-types.js";

// =============================================================================
// Public Types
// =============================================================================

export interface MergeResult {
  /** Merged contribution data */
  data: TokenContributionData;
  /** Number of days in local data */
  localDays: number;
  /** Number of days in imported data */
  importedDays: number;
  /** Number of days after merge */
  mergedDays: number;
  /** Number of duplicate entries that were summed */
  duplicatesMerged: number;
}

// =============================================================================
// Merge Helpers
// =============================================================================

function sumTokenBreakdown(a: TokenBreakdown, b: TokenBreakdown): TokenBreakdown {
  return {
    input: a.input + b.input,
    output: a.output + b.output,
    cacheRead: a.cacheRead + b.cacheRead,
    cacheWrite: a.cacheWrite + b.cacheWrite,
    reasoning: a.reasoning + b.reasoning,
  };
}

function sourceKey(s: SourceContribution): string {
  return `${s.source}:${s.modelId}:${s.providerId || ""}`;
}

function mergeSourceArrays(
  local: SourceContribution[],
  imported: SourceContribution[]
): { sources: SourceContribution[]; duplicates: number } {
  const map = new Map<string, SourceContribution>();
  let duplicates = 0;

  for (const s of local) {
    map.set(sourceKey(s), { ...s, tokens: { ...s.tokens } });
  }

  for (const s of imported) {
    const key = sourceKey(s);
    const existing = map.get(key);
    if (existing) {
      existing.tokens = sumTokenBreakdown(existing.tokens, s.tokens);
      existing.cost += s.cost;
      existing.messages += s.messages;
      duplicates++;
    } else {
      map.set(key, { ...s, tokens: { ...s.tokens } });
    }
  }

  return { sources: Array.from(map.values()), duplicates };
}

// =============================================================================
// Core Merge
// =============================================================================

export function mergeContributions(
  local: TokenContributionData,
  imported: TokenContributionData,
  label?: string
): MergeResult {
  const localDays = local.contributions.length;
  const importedDays = imported.contributions.length;
  let totalDuplicates = 0;

  // Build a map of local contributions by date
  const merged = new Map<string, DailyContribution>();
  for (const c of local.contributions) {
    merged.set(c.date, {
      ...c,
      totals: { ...c.totals },
      tokenBreakdown: { ...c.tokenBreakdown },
      sources: c.sources.map((s) => ({ ...s, tokens: { ...s.tokens } })),
    });
  }

  // Merge imported contributions
  for (const c of imported.contributions) {
    const existing = merged.get(c.date);
    if (existing) {
      const { sources, duplicates } = mergeSourceArrays(existing.sources, c.sources);
      existing.sources = sources;
      totalDuplicates += duplicates;

      existing.totals.tokens += c.totals.tokens;
      existing.totals.cost += c.totals.cost;
      existing.totals.messages += c.totals.messages;

      existing.tokenBreakdown = sumTokenBreakdown(existing.tokenBreakdown, c.tokenBreakdown);

      // Recalculate intensity based on the merged max cost
      // (will be recalculated after full merge)
    } else {
      // Tag imported sources with label if provided
      const taggedSources = label
        ? c.sources.map((s) => ({
            ...s,
            // Prepend label to providerId to distinguish machines
            providerId: s.providerId ? `${label}:${s.providerId}` : label,
          }))
        : c.sources;

      merged.set(c.date, {
        ...c,
        sources: taggedSources,
      });
    }
  }

  // Sort by date
  const contributions = Array.from(merged.values()).sort((a, b) =>
    a.date.localeCompare(b.date)
  );

  // Recalculate intensities based on max cost
  const maxCost = contributions.reduce(
    (max, c) => Math.max(max, c.totals.cost),
    0
  );
  for (const c of contributions) {
    if (maxCost === 0) {
      c.intensity = 0;
    } else {
      const ratio = c.totals.cost / maxCost;
      c.intensity = ratio === 0 ? 0 : ratio <= 0.25 ? 1 : ratio <= 0.5 ? 2 : ratio <= 0.75 ? 3 : 4;
    }
  }

  // Merge summary
  const allSources = new Set([
    ...local.summary.sources,
    ...imported.summary.sources,
  ]);
  const allModels = new Set([
    ...local.summary.models,
    ...imported.summary.models,
  ]);

  const dateRangeStart =
    contributions.length > 0 ? contributions[0].date : local.meta.dateRange.start;
  const dateRangeEnd =
    contributions.length > 0
      ? contributions[contributions.length - 1].date
      : local.meta.dateRange.end;

  const totalCost = contributions.reduce((sum, c) => sum + c.totals.cost, 0);
  const totalTokens = contributions.reduce((sum, c) => sum + c.totals.tokens, 0);
  const activeDays = contributions.filter((c) => c.totals.tokens > 0).length;

  // Merge years
  const yearMap = new Map<string, { totalTokens: number; totalCost: number; rangeStart: string; rangeEnd: string }>();
  for (const y of [...local.years, ...imported.years]) {
    const existing = yearMap.get(y.year);
    if (existing) {
      existing.totalTokens += y.totalTokens;
      existing.totalCost += y.totalCost;
      if (y.range.start < existing.rangeStart) existing.rangeStart = y.range.start;
      if (y.range.end > existing.rangeEnd) existing.rangeEnd = y.range.end;
    } else {
      yearMap.set(y.year, {
        totalTokens: y.totalTokens,
        totalCost: y.totalCost,
        rangeStart: y.range.start,
        rangeEnd: y.range.end,
      });
    }
  }

  const result: TokenContributionData = {
    meta: {
      generatedAt: new Date().toISOString(),
      version: local.meta.version,
      dateRange: {
        start: dateRangeStart,
        end: dateRangeEnd,
      },
    },
    summary: {
      totalTokens,
      totalCost,
      totalDays: contributions.length,
      activeDays,
      averagePerDay: activeDays > 0 ? totalCost / activeDays : 0,
      maxCostInSingleDay: maxCost,
      sources: Array.from(allSources),
      models: Array.from(allModels),
    },
    years: Array.from(yearMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([year, y]) => ({
        year,
        totalTokens: y.totalTokens,
        totalCost: y.totalCost,
        range: { start: y.rangeStart, end: y.rangeEnd },
      })),
    contributions,
  };

  return {
    data: result,
    localDays,
    importedDays,
    mergedDays: contributions.length,
    duplicatesMerged: totalDuplicates,
  };
}

// =============================================================================
// Export helpers
// =============================================================================

/**
 * Create a machine-identifiable export by adding machine metadata.
 */
export function createExport(data: TokenContributionData, machineId: string): TokenContributionData {
  return {
    ...data,
    meta: {
      ...data.meta,
      // Store machine ID in a way that's compatible with the type
      generatedAt: `${data.meta.generatedAt} [${machineId}]`,
    },
  };
}

/**
 * Extract model-by-date breakdown from contribution data.
 * Returns a map of modelId -> array of daily entries for that model.
 */
export function extractModelByDate(
  data: TokenContributionData
): Map<string, Array<{ date: string; source: string; tokens: TokenBreakdown; cost: number; messages: number }>> {
  const result = new Map<string, Array<{ date: string; source: string; tokens: TokenBreakdown; cost: number; messages: number }>>();

  for (const day of data.contributions) {
    for (const src of day.sources) {
      const entries = result.get(src.modelId) || [];
      entries.push({
        date: day.date,
        source: src.source,
        tokens: src.tokens,
        cost: src.cost,
        messages: src.messages,
      });
      result.set(src.modelId, entries);
    }
  }

  return result;
}
