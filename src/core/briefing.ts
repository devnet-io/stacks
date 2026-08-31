import { createHash } from "node:crypto";
import { open, realpath, stat } from "node:fs/promises";
import path from "node:path";
import type { ContextBriefing, ContextBriefingItem, ContextBriefingOmission, ContextPlan, LoadedStack } from "./types.ts";
import { componentRoot } from "./paths.ts";

export const ORIENTATION_BRIEFING_BYTES = 32 * 1024;
export const REFRESH_BRIEFING_BYTES = 8 * 1024;
export const MAX_BRIEFING_BYTES = 256 * 1024;

export interface BriefingOptions {
  mode?: "orientation" | "refresh";
  maxBytes?: number;
}

function isWithin(parent: string, candidate: string): boolean {
  const relative = path.relative(parent, candidate);
  return relative === "" || (relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
}

function validateBudget(mode: "orientation" | "refresh", requested: number | undefined): number {
  const value = requested ?? (mode === "orientation" ? ORIENTATION_BRIEFING_BYTES : REFRESH_BRIEFING_BYTES);
  if (!Number.isSafeInteger(value) || value < 1 || value > MAX_BRIEFING_BYTES) {
    throw new Error(`Briefing maxBytes must be an integer from 1 through ${MAX_BRIEFING_BYTES}.`);
  }
  return value;
}

function ownerRoot(stack: LoadedStack, componentId: string): string {
  if (componentId === "$stack") return stack.root;
  const component = stack.manifest.components.find((candidate) => candidate.id === componentId);
  if (!component) throw new Error(`Unknown context owner ${componentId}.`);
  return componentRoot(stack, component);
}

function omission(planItem: ContextPlan["items"][number], reason: ContextBriefingOmission["reason"], detail: string): ContextBriefingOmission {
  return { componentId: planItem.componentId, path: planItem.path, reason, detail };
}

function trimToBytes(value: string, maximum: number): string {
  if (Buffer.byteLength(value, "utf8") <= maximum) return value;
  let end = value.length;
  while (end > 0 && Buffer.byteLength(value.slice(0, end), "utf8") > maximum) end -= 1;
  return value.slice(0, end);
}

export async function materializeContextBriefing(
  stack: LoadedStack,
  plan: ContextPlan,
  options: BriefingOptions = {},
): Promise<ContextBriefing> {
  const mode = options.mode ?? "orientation";
  const maxBytes = validateBudget(mode, options.maxBytes);
  const items: ContextBriefingItem[] = [];
  const omissions: ContextBriefingOmission[] = [];
  let usedBytes = 0;

  for (const planItem of plan.items) {
    if (!planItem.exists) {
      omissions.push(omission(planItem, "missing", "The declared context path does not exist."));
      continue;
    }
    const remaining = maxBytes - usedBytes;
    if (remaining <= 0) {
      omissions.push(omission(planItem, "budget", "The briefing byte budget was exhausted by higher-ranked context."));
      continue;
    }

    let canonicalRoot: string;
    let canonicalFile: string;
    try {
      [canonicalRoot, canonicalFile] = await Promise.all([realpath(ownerRoot(stack, planItem.componentId)), realpath(planItem.absolutePath)]);
    } catch (error) {
      const missing = (error as NodeJS.ErrnoException).code === "ENOENT";
      omissions.push(omission(planItem, missing ? "missing" : "unreadable", missing ? "The declared context path could not be resolved." : "The declared context path is not readable."));
      continue;
    }
    if (!isWithin(canonicalRoot, canonicalFile)) {
      omissions.push(omission(planItem, "unsafe-path", "The resolved path escapes its owning component root."));
      continue;
    }
    let metadata: Awaited<ReturnType<typeof stat>>;
    try { metadata = await stat(canonicalFile); }
    catch {
      omissions.push(omission(planItem, "unreadable", "The context file metadata could not be read."));
      continue;
    }
    if (!metadata.isFile()) {
      omissions.push(omission(planItem, "not-file", "Directory and glob expansion are not materialized in the MVP briefing."));
      continue;
    }

    let handle: Awaited<ReturnType<typeof open>>;
    try { handle = await open(canonicalFile, "r"); }
    catch {
      omissions.push(omission(planItem, "unreadable", "The context file could not be opened for reading."));
      continue;
    }
    let buffer: Buffer;
    try {
      const requested = Math.min(metadata.size, remaining + 4);
      buffer = Buffer.alloc(requested);
      const read = await handle.read(buffer, 0, requested, 0);
      buffer = buffer.subarray(0, read.bytesRead);
    } catch {
      omissions.push(omission(planItem, "unreadable", "The context file could not be read."));
      continue;
    } finally {
      await handle.close();
    }
    if (buffer.includes(0)) {
      omissions.push(omission(planItem, "binary", "Binary content is not included in an agent briefing."));
      continue;
    }
    const decoded = buffer.toString("utf8");
    const content = trimToBytes(decoded, remaining);
    const contentBytes = Buffer.byteLength(content, "utf8");
    if (contentBytes === 0 && metadata.size > 0) {
      omissions.push(omission(planItem, "budget", "No complete text fit in the remaining briefing byte budget."));
      continue;
    }
    const truncated = metadata.size > contentBytes;
    usedBytes += contentBytes;
    items.push({
      componentId: planItem.componentId,
      path: planItem.path,
      absolutePath: planItem.absolutePath,
      strength: planItem.strength,
      reasons: [...planItem.reasons],
      capabilities: [...planItem.capabilities],
      content,
      contentBytes,
      sourceBytes: metadata.size,
      truncated,
      contentSha256: createHash("sha256").update(content).digest("hex"),
    });
    if (truncated) omissions.push(omission(planItem, "budget", `Included the first ${contentBytes} of ${metadata.size} bytes.`));
  }

  const digestInput = {
    stackId: plan.stackId,
    targetComponentId: plan.targetComponentId,
    mode,
    maxBytes,
    plan: plan.items.map(({ componentId, path: itemPath, strength, priority, reasons, capabilities, chains, taskScore }) => ({ componentId, path: itemPath, strength, priority, reasons, capabilities, chains, taskScore })),
    items: items.map(({ componentId, path: itemPath, contentSha256, contentBytes, sourceBytes, truncated }) => ({ componentId, path: itemPath, contentSha256, contentBytes, sourceBytes, truncated })),
    omissions,
    warnings: plan.warnings,
    errors: plan.errors,
  };
  return {
    schemaVersion: "0.1",
    mode,
    digest: createHash("sha256").update(JSON.stringify(digestInput)).digest("hex"),
    budget: { maxBytes, usedBytes, remainingBytes: maxBytes - usedBytes },
    items,
    omissions,
  };
}
