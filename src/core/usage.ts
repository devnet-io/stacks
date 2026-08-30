import type { LoadedStack, UsageData, UsageReport, UsageReportRow } from "./types.ts";
import { readEvents } from "./events.ts";

function number(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export async function buildUsageReport(stack: LoadedStack): Promise<UsageReport> {
  const read = await readEvents(stack);
  const rows = new Map<string, UsageReportRow>();
  for (const event of read.events) {
    if (event.type !== "usage.recorded") continue;
    const usage = event.data as Partial<UsageData>;
    if (!usage.provider || !usage.model) {
      read.warnings.push(`Usage event ${event.id} is missing provider or model.`);
      continue;
    }
    const key = `${usage.provider}\u0000${usage.model}\u0000${event.componentId ?? ""}`;
    const row = rows.get(key) ?? {
      provider: usage.provider,
      model: usage.model,
      ...(event.componentId === undefined ? {} : { componentId: event.componentId }),
      events: 0,
      inputTokens: 0,
      outputTokens: 0,
      cachedInputTokens: 0,
      reasoningTokens: 0,
      toolCalls: 0,
      durationMs: 0,
      amounts: {},
      costKinds: {},
    };
    row.events += 1;
    row.inputTokens += number(usage.inputTokens);
    row.outputTokens += number(usage.outputTokens);
    row.cachedInputTokens += number(usage.cachedInputTokens);
    row.reasoningTokens += number(usage.reasoningTokens);
    row.toolCalls += number(usage.toolCalls);
    row.durationMs += number(usage.durationMs);
    if (usage.amount !== undefined) {
      const currency = usage.currency ?? "UNSPECIFIED";
      row.amounts[currency] = (row.amounts[currency] ?? 0) + number(usage.amount);
      const kind = usage.costKind ?? "unspecified";
      row.costKinds[kind] = (row.costKinds[kind] ?? 0) + 1;
    }
    rows.set(key, row);
  }
  return {
    schemaVersion: "0.1",
    generatedAt: new Date().toISOString(),
    rows: [...rows.values()].sort((left, right) => {
      const provider = left.provider.localeCompare(right.provider);
      if (provider !== 0) return provider;
      const model = left.model.localeCompare(right.model);
      if (model !== 0) return model;
      return (left.componentId ?? "").localeCompare(right.componentId ?? "");
    }),
    warnings: read.warnings,
  };
}
