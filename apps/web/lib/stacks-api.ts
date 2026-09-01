import type { StackOverview } from '../../../src/application/overview.ts';
import type { StackIntegrations } from '../../../src/application/integrations.ts';
import type { StackGraph } from '../../../src/application/graph.ts';
import type { ActivityTurnDetail, ActivityWorkDetail, StackActivity } from '../../../src/application/activity.ts';
import type { CapabilityRequestDetail, CapabilityRequestList } from '../../../src/application/capability-requests.ts';
import type { SyncResult } from '../../../src/core/types.ts';
import type { ComponentListOutput, ComponentOutput } from '../../../src/application/stacks-application.ts';

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
  input: Record<string, unknown>,
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

export async function updateComponent(input: {
  stack: string;
  componentId: string;
  name?: string | null;
  description?: string | null;
  kind?: string;
  access?: 'read-only' | 'read-write';
}): Promise<ComponentOutput> {
  return mutation('/api/v0.1/component', 'PUT', input);
}

export async function configureCapabilityProvider(input: {
  stack: string;
  componentId: string;
  capability: string;
  description?: string;
  contextPath?: string;
  strength?: 'required' | 'preferred' | 'reference';
  priority?: number;
  artifactEcosystem?: string;
  artifactName?: string;
  artifactPath?: string;
}): Promise<ComponentOutput> {
  return mutation('/api/v0.1/capability-provider', 'PUT', input);
}

export async function configureCapabilityRequirement(input: {
  stack: string;
  componentId: string;
  capability: string;
  from?: string;
  optional?: boolean;
}): Promise<ComponentOutput> {
  return mutation('/api/v0.1/capability-requirement', 'PUT', input);
}

export async function configureComponentGuidance(input: {
  stack: string;
  componentId: string;
  path: string;
  description?: string;
  strength?: 'required' | 'preferred' | 'reference';
  priority?: number;
  appliesTo?: string[];
}): Promise<ComponentOutput> {
  return mutation('/api/v0.1/component-guidance', 'PUT', input);
}

export async function fetchComponents(
  stack: string,
  signal?: AbortSignal,
): Promise<ComponentListOutput> {
  const response = await fetch(endpoint('/api/v0.1/components', stack), {
    headers: { Accept: 'application/json' },
    signal,
  });
  const body = (await response.json()) as ComponentListOutput | { error?: string };
  if (!response.ok)
    throw new Error('error' in body && body.error ? body.error : `Local API returned ${response.status}.`);
  if (!('components' in body)) throw new Error('The local API returned an unsupported component contract.');
  return body;
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

export async function fetchActivity(
  stack?: string,
  signal?: AbortSignal,
): Promise<StackActivity> {
  const response = await fetch(endpoint('/api/v0.1/activity', stack), {
    headers: { Accept: 'application/json' },
    signal,
  });
  const body = (await response.json()) as StackActivity | { error?: string };
  if (!response.ok)
    throw new Error(
      'error' in body && body.error
        ? body.error
        : `Local API returned ${response.status}.`,
    );
  if (
    !('schemaVersion' in body) ||
    body.schemaVersion !== '0.1' ||
    !('work' in body)
  )
    throw new Error('The local API returned an unsupported activity contract.');
  return body;
}

export async function fetchActivityWork(
  stack: string,
  sessionId: string,
  signal?: AbortSignal,
): Promise<ActivityWorkDetail> {
  const url = new URL(endpoint('/api/v0.1/activity/work', stack));
  url.searchParams.set('session', sessionId);
  const response = await fetch(url, { headers: { Accept: 'application/json' }, signal });
  const body = (await response.json()) as ActivityWorkDetail | { error?: string };
  if (!response.ok) throw new Error('error' in body && body.error ? body.error : `Local API returned ${response.status}.`);
  if (!('work' in body) || !('turns' in body)) throw new Error('The local API returned an unsupported work detail contract.');
  return body;
}

export async function fetchActivityTurn(
  stack: string,
  sessionId: string,
  turnId: string,
  signal?: AbortSignal,
): Promise<ActivityTurnDetail> {
  const url = new URL(endpoint('/api/v0.1/activity/turn', stack));
  url.searchParams.set('session', sessionId);
  url.searchParams.set('turn', turnId);
  const response = await fetch(url, { headers: { Accept: 'application/json' }, signal });
  const body = (await response.json()) as ActivityTurnDetail | { error?: string };
  if (!response.ok) throw new Error('error' in body && body.error ? body.error : `Local API returned ${response.status}.`);
  if (!('work' in body) || !('turn' in body)) throw new Error('The local API returned an unsupported turn detail contract.');
  return body;
}

export async function fetchCapabilityRequests(stack: string, signal?: AbortSignal): Promise<CapabilityRequestList> {
  const response = await fetch(endpoint('/api/v0.1/capability-requests', stack), { headers: { Accept: 'application/json' }, signal });
  const body = (await response.json()) as CapabilityRequestList | { error?: string };
  if (!response.ok) throw new Error('error' in body && body.error ? body.error : `Local API returned ${response.status}.`);
  if (!('requests' in body)) throw new Error('The local API returned an unsupported capability-request contract.');
  return body;
}

export async function fetchCapabilityRequest(stack: string, requestId: string, signal?: AbortSignal): Promise<CapabilityRequestDetail> {
  const url = new URL(endpoint('/api/v0.1/capability-request', stack));
  url.searchParams.set('request', requestId);
  const response = await fetch(url, { headers: { Accept: 'application/json' }, signal });
  const body = (await response.json()) as CapabilityRequestDetail | { error?: string };
  if (!response.ok) throw new Error('error' in body && body.error ? body.error : `Local API returned ${response.status}.`);
  if (!('request' in body) || !('transitions' in body)) throw new Error('The local API returned an unsupported capability-request detail contract.');
  return body;
}

export async function createCapabilityRequest(input: {
  stack: string; requesterComponentId: string; providerComponentId: string; sessionId: string;
  capability: string; reason: string; acceptance?: string;
}): Promise<CapabilityRequestDetail> {
  return mutation('/api/v0.1/capability-requests', 'POST', input);
}

export async function transitionCapabilityRequest(input: {
  stack: string; requestId: string; componentId: string;
  status: 'in-progress' | 'provider-complete' | 'consumer-verified' | 'rejected' | 'superseded';
  summary: string; evidence?: string;
}): Promise<CapabilityRequestDetail> {
  return mutation('/api/v0.1/capability-request', 'PUT', input);
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
