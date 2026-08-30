import type { StackOverview } from '../../../src/application/overview.ts';
import type { StackIntegrations } from '../../../src/application/integrations.ts';
import type { StackGraph } from '../../../src/application/graph.ts';
import type { SyncResult } from '../../../src/core/types.ts';

export function localApiOrigin(): string {
  return typeof window === 'undefined' ? '' : window.location.origin;
}

function endpoint(path: string, stack?: string): string {
  const url = new URL(path, localApiOrigin());
  if (stack) url.searchParams.set('stack', stack);
  return url.toString();
}

export interface RegisteredStack {
  id: string;
  namespace: string;
  name: string;
}
export interface RegisteredStacksResponse {
  schemaVersion: '0.1';
  stacks: RegisteredStack[];
}
export interface ComponentMutationResponse {
  schemaVersion: '0.1';
  stack: RegisteredStack;
  component: { id: string; path: string };
  sync: SyncResult;
}

async function mutation<T>(
  path: string,
  method: 'POST' | 'PUT',
  input: Record<string, string | undefined>,
): Promise<T> {
  const response = await fetch(endpoint(path), {
    method,
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify(
      Object.fromEntries(
        Object.entries(input).filter(
          ([, value]) => value !== undefined && value !== '',
        ),
      ),
    ),
  });
  const body = (await response.json()) as T | { error?: string };
  if (!response.ok)
    throw new Error(
      'error' in body && body.error
        ? body.error
        : `Local API returned ${response.status}.`,
    );
  return body as T;
}

export async function createStack(
  selector: string,
): Promise<{ schemaVersion: '0.1'; stack: RegisteredStack }> {
  return mutation('/api/v0.1/stacks', 'POST', { selector });
}

export async function addComponent(input: {
  stack: string;
  id: string;
  path: string;
  name?: string;
  kind?: string;
  git?: string;
}): Promise<ComponentMutationResponse> {
  return mutation('/api/v0.1/components', 'POST', input);
}

export async function bindComponent(input: {
  stack: string;
  componentId: string;
  path: string;
}): Promise<ComponentMutationResponse> {
  return mutation('/api/v0.1/component-binding', 'PUT', input);
}

export async function fetchStacks(
  signal?: AbortSignal,
): Promise<RegisteredStacksResponse> {
  const response = await fetch(endpoint('/api/v0.1/stacks'), {
    headers: { Accept: 'application/json' },
    signal,
  });
  const body = (await response.json()) as
    | RegisteredStacksResponse
    | { error?: string };
  if (!response.ok)
    throw new Error(
      'error' in body && body.error
        ? body.error
        : `Local API returned ${response.status}.`,
    );
  if (!('stacks' in body))
    throw new Error(
      'The local API returned an unsupported Stack catalog contract.',
    );
  return body;
}

export async function fetchOverview(
  stack?: string,
  signal?: AbortSignal,
): Promise<StackOverview> {
  const response = await fetch(endpoint('/api/v0.1/overview', stack), {
    headers: { Accept: 'application/json' },
    signal,
  });
  const body = (await response.json()) as StackOverview | { error?: string };
  if (!response.ok)
    throw new Error(
      'error' in body && body.error
        ? body.error
        : `Local API returned ${response.status}.`,
    );
  if (
    !('schemaVersion' in body) ||
    body.schemaVersion !== '0.1' ||
    !('stack' in body)
  ) {
    throw new Error('The local API returned an unsupported overview contract.');
  }
  return body;
}

export async function fetchIntegrations(
  stack?: string,
  signal?: AbortSignal,
): Promise<StackIntegrations> {
  const response = await fetch(endpoint('/api/v0.1/integrations', stack), {
    headers: { Accept: 'application/json' },
    signal,
  });
  const body = (await response.json()) as
    | StackIntegrations
    | { error?: string };
  if (!response.ok)
    throw new Error(
      'error' in body && body.error
        ? body.error
        : `Local API returned ${response.status}.`,
    );
  if (
    !('schemaVersion' in body) ||
    body.schemaVersion !== '0.1' ||
    !('mcp' in body)
  )
    throw new Error(
      'The local API returned an unsupported integrations contract.',
    );
  return body;
}

export async function fetchGraph(
  stack?: string,
  signal?: AbortSignal,
): Promise<StackGraph> {
  const origin = localApiOrigin();
  const response = await fetch(endpoint('/api/v0.1/graph', stack), {
    headers: { Accept: 'application/json' },
    signal,
  });
  if (response.status === 404) {
    throw new Error(
      `The local API at ${origin} is from an older Stacks build. Restart \`stacks ui\` and open the URL it prints.`,
    );
  }
  const body = (await response.json()) as StackGraph | { error?: string };
  if (!response.ok)
    throw new Error(
      'error' in body && body.error
        ? body.error
        : `Local API returned ${response.status}.`,
    );
  if (
    !('schemaVersion' in body) ||
    body.schemaVersion !== '0.1' ||
    !('nodes' in body)
  )
    throw new Error('The local API returned an unsupported graph contract.');
  return body;
}
