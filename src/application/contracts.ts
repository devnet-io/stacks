import type { ComponentStatus, LoadedStack, StackManifest, SyncResult } from "../core/types.ts";

export const OUTPUT_SCHEMA_VERSION = "0.1" as const;

export interface StackIdentity {
  id: string;
  namespace: string;
  name: string;
}

export interface InitOutput {
  schemaVersion: typeof OUTPUT_SCHEMA_VERSION;
  stack: StackIdentity;
  manifestPath: string;
}

export interface ValidateOutput {
  schemaVersion: typeof OUTPUT_SCHEMA_VERSION;
  manifestPath: string;
  valid: boolean;
  errors: string[];
  stack?: StackIdentity;
}

export interface StatusOutput {
  schemaVersion: typeof OUTPUT_SCHEMA_VERSION;
  stack: StackIdentity;
  components: ComponentStatus[];
}

export interface SyncOutput {
  schemaVersion: typeof OUTPUT_SCHEMA_VERSION;
  stack: StackIdentity;
  results: SyncResult[];
}

export interface LockOutput {
  schemaVersion: typeof OUTPUT_SCHEMA_VERSION;
  stack: StackIdentity;
  lockPath: string;
}

export function stackIdentity(manifest: StackManifest): StackIdentity {
  return {
    id: manifest.metadata.id,
    namespace: manifest.metadata.namespace,
    name: manifest.metadata.name,
  };
}

export function initOutput(stack: LoadedStack): InitOutput {
  return {
    schemaVersion: OUTPUT_SCHEMA_VERSION,
    stack: stackIdentity(stack.manifest),
    manifestPath: stack.manifestPath,
  };
}

export function validateOutput(result: {
  manifestPath: string;
  parsed: unknown;
  valid: boolean;
  errors: string[];
}): ValidateOutput {
  let stack: StackIdentity | undefined;
  if (result.valid) {
    stack = stackIdentity(result.parsed as StackManifest);
  }
  return {
    schemaVersion: OUTPUT_SCHEMA_VERSION,
    manifestPath: result.manifestPath,
    valid: result.valid,
    errors: result.errors,
    ...(stack === undefined ? {} : { stack }),
  };
}

export function statusOutput(stack: LoadedStack, components: ComponentStatus[]): StatusOutput {
  return {
    schemaVersion: OUTPUT_SCHEMA_VERSION,
    stack: stackIdentity(stack.manifest),
    components,
  };
}

export function syncOutput(stack: LoadedStack, results: SyncResult[]): SyncOutput {
  return {
    schemaVersion: OUTPUT_SCHEMA_VERSION,
    stack: stackIdentity(stack.manifest),
    results,
  };
}

export function lockOutput(stack: LoadedStack, lockPath: string): LockOutput {
  return {
    schemaVersion: OUTPUT_SCHEMA_VERSION,
    stack: stackIdentity(stack.manifest),
    lockPath,
  };
}
