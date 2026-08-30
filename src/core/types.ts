export type GuidanceStrength = "required" | "preferred" | "reference";
export type ComponentAccess = "read-only" | "read-write";
export type CostKind = "reported" | "estimated" | "allocated";

export interface ContextPath {
  path: string;
  description?: string;
  strength?: GuidanceStrength;
  priority?: number;
  tags?: string[];
}

export interface Guidance extends ContextPath {
  appliesTo?: string[];
}

export interface CapabilityExport {
  capability: string;
  description?: string;
  context?: ContextPath[];
}

export interface CapabilityRequirement {
  capability: string;
  from?: string;
  optional?: boolean;
}

export interface PathSource {
  type: "path";
  path: string;
}

export interface GitSource {
  type: "git";
  url: string;
  ref?: string;
  checkout?: string;
}

export type ComponentSource = PathSource | GitSource;

export interface StackComponent {
  id: string;
  name?: string;
  kind?: string;
  description?: string;
  source: ComponentSource;
  access?: ComponentAccess;
  provides?: CapabilityExport[];
  consumes?: CapabilityRequirement[];
  dependsOn?: string[];
  guidance?: Guidance[];
  extensions?: Record<string, unknown>;
}

export interface StackManifest {
  apiVersion: "stacks.dev/v0alpha1";
  kind: "Stack";
  metadata: {
    id: string;
    namespace: string;
    name: string;
    description?: string;
    version?: string;
  };
  workspace?: {
    directory?: string;
    stateDirectory?: string;
  };
  context?: {
    always?: ContextPath[];
  };
  components: StackComponent[];
  extensions?: Record<string, unknown>;
}

export interface LoadedStack {
  root: string;
  manifestPath: string;
  manifest: StackManifest;
}

export interface ContextPlanItem {
  componentId: string;
  path: string;
  absolutePath: string;
  strength: GuidanceStrength;
  priority: number;
  reasons: string[];
  capabilities: string[];
  chains: string[][];
  exists: boolean;
  estimatedBytes?: number;
}

export interface ContextPlan {
  schemaVersion: "0.1";
  stackId: string;
  targetComponentId: string;
  task?: string;
  generatedAt: string;
  items: ContextPlanItem[];
  warnings: string[];
  errors: string[];
}

export interface GitStatus {
  isRepository: boolean;
  branch?: string;
  commit?: string;
  dirty?: boolean;
  remoteUrl?: string;
  error?: string;
}

export interface ComponentStatus {
  id: string;
  kind?: string;
  sourceType: ComponentSource["type"];
  root: string;
  exists: boolean;
  access: ComponentAccess;
  git?: GitStatus;
  issues: string[];
}

export interface SyncResult {
  componentId: string;
  action: "skip" | "clone" | "fetch" | "inspect" | "error";
  root: string;
  changed: boolean;
  message: string;
}

export interface EventActor {
  agent?: string;
  client?: string;
  model?: string;
}

export interface StackEvent<TData = Record<string, unknown>> {
  schemaVersion: "0.1";
  id: string;
  timestamp: string;
  type: string;
  stackId: string;
  componentId?: string;
  sessionId?: string;
  workId?: string;
  actor?: EventActor;
  data: TData;
}

export interface UsageData {
  provider: string;
  model: string;
  inputTokens?: number;
  outputTokens?: number;
  cachedInputTokens?: number;
  reasoningTokens?: number;
  toolCalls?: number;
  durationMs?: number;
  amount?: number;
  currency?: string;
  costKind?: CostKind;
  pricingReference?: string;
  note?: string;
}

export interface UsageReportRow {
  provider: string;
  model: string;
  componentId?: string;
  events: number;
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number;
  reasoningTokens: number;
  toolCalls: number;
  durationMs: number;
  amounts: Record<string, number>;
  costKinds: Record<string, number>;
}

export interface UsageReport {
  schemaVersion: "0.1";
  generatedAt: string;
  rows: UsageReportRow[];
  warnings: string[];
}
