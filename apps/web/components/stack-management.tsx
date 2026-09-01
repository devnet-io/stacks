import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  Plus,
  RefreshCw,
} from 'lucide-react';
import {
  type FormEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useState,
} from 'react';
import type { StackOverview } from '../../../src/application/overview.ts';
import type { ComponentListOutput } from '../../../src/application/stacks-application.ts';
import type { ComponentDescriptorReport } from '../../../src/core/types.ts';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  addComponent,
  bindComponent,
  configureCapabilityProvider,
  configureCapabilityRequirement,
  configureComponentGuidance,
  createStack,
  fetchComponents,
  fetchOverview,
} from '@/lib/stacks-api';

export function StackManagement({
  stack,
  onCatalogChanged,
}: {
  stack?: string;
  onCatalogChanged(stack?: string): Promise<void>;
}) {
  const [overview, setOverview] = useState<StackOverview>();
  const [components, setComponents] = useState<ComponentListOutput>();
  const [loading, setLoading] = useState(Boolean(stack));
  const [loadError, setLoadError] = useState<string>();
  const load = useCallback(async () => {
    if (!stack) {
      setOverview(undefined);
      setComponents(undefined);
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(undefined);
    try {
      const [nextOverview, nextComponents] = await Promise.all([
        fetchOverview(stack),
        fetchComponents(stack),
      ]);
      setOverview(nextOverview);
      setComponents(nextComponents);
    } catch (error) {
      setLoadError(message(error));
    } finally {
      setLoading(false);
    }
  }, [stack]);
  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-6">
      <CreateStackForm onCreated={onCatalogChanged} />
      {!stack ? (
        <Card>
          <CardHeader>
            <CardTitle>Components</CardTitle>
            <CardDescription>
              Select or create a Stack before adding components.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : loading && !overview ? (
        <ManagementSkeleton />
      ) : loadError && !overview ? (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertTitle>Could not load management data</AlertTitle>
          <AlertDescription>{loadError}</AlertDescription>
          <Button
            variant="outline"
            size="sm"
            className="mt-3 w-fit"
            onClick={() => void load()}
          >
            <RefreshCw />
            Retry
          </Button>
        </Alert>
      ) : overview && components ? (
        <div className="space-y-6">
          <div className="grid gap-6 xl:grid-cols-2">
            <AddComponentForm
              stack={stack}
              onChanged={async () => {
                await load();
                await onCatalogChanged(stack);
              }}
            />
            <BindingForm
              stack={stack}
              overview={overview}
              onChanged={async () => {
                await load();
                await onCatalogChanged(stack);
              }}
            />
          </div>
          <ContextConfiguration
            stack={stack}
            components={components}
            onChanged={async () => {
              await load();
              await onCatalogChanged(stack);
            }}
          />
        </div>
      ) : null}
    </div>
  );
}

function ContextConfiguration({
  stack,
  components,
  onChanged,
}: {
  stack: string;
  components: ComponentListOutput;
  onChanged(): Promise<void>;
}) {
  const [componentId, setComponentId] = useState(components.components[0]?.component.id ?? '');
  useEffect(() => {
    if (!components.components.some((item) => item.component.id === componentId)) {
      setComponentId(components.components[0]?.component.id ?? '');
    }
  }, [componentId, components]);
  const selectedEntry = components.components.find((item) => item.component.id === componentId);
  const selected = selectedEntry?.component;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Context and capabilities</CardTitle>
        <CardDescription>
          Declare what a component provides, what it consumes, and which component-relative guidance agents should inspect.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {components.components.length === 0 ? (
          <p className="text-sm text-muted-foreground">Add a component before configuring agent context.</p>
        ) : (
          <>
            <Field label="Component to configure" htmlFor="context-component">
              <select id="context-component" value={componentId} onChange={(event) => setComponentId(event.target.value)} className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm sm:max-w-md">
                {components.components.map(({ component }) => <option key={component.id} value={component.id}>{component.name ?? component.id} ({component.id})</option>)}
              </select>
            </Field>
            {selectedEntry ? <DescriptorSummary descriptor={selectedEntry.descriptor} /> : null}
            <div className="grid gap-6 xl:grid-cols-3">
              <CapabilityProviderForm key={`provider-${componentId}`} stack={stack} componentId={componentId} onChanged={onChanged} />
              <CapabilityRequirementForm key={`requirement-${componentId}`} stack={stack} componentId={componentId} components={components} onChanged={onChanged} />
              <GuidanceForm key={`guidance-${componentId}`} stack={stack} componentId={componentId} onChanged={onChanged} />
            </div>
            {selected && (
              <div className="grid gap-4 border-t pt-5 text-sm md:grid-cols-3">
                <ConfigurationSummary label="Provides" values={(selected.provides ?? []).map((item) => `${item.capability}${item.artifact ? ` · ${item.artifact.ecosystem}:${item.artifact.name}` : ''}`)} />
                <ConfigurationSummary label="Consumes" values={(selected.consumes ?? []).map((item) => `${item.capability}${item.from ? ` from ${item.from}` : ''}`)} />
                <ConfigurationSummary label="Guidance" values={(selected.guidance ?? []).map((item) => `${item.path} · ${item.strength ?? 'reference'}`)} />
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function DescriptorSummary({ descriptor }: { descriptor: ComponentDescriptorReport }) {
  if (descriptor.status === 'invalid' || descriptor.status === 'unavailable') {
    return <Alert variant="destructive"><AlertCircle /><AlertTitle>Provider descriptor {descriptor.status}</AlertTitle><AlertDescription><p className="break-all">{descriptor.path}</p><ul className="mt-2 list-disc space-y-1 pl-4">{descriptor.errors.map((error) => <li key={error}>{error}</li>)}</ul><p className="mt-2">Stacks ignored the descriptor and kept explicit Stack declarations active.</p></AlertDescription></Alert>;
  }
  if (descriptor.status === 'absent') {
    return <div className="rounded-lg border border-dashed p-4 text-sm"><p className="font-medium">No provider descriptor</p><p className="mt-1 text-muted-foreground">Optional descriptor: <span className="break-all font-mono text-xs">{descriptor.path}</span>. Explicit Stack declarations remain the complete source for this component.</p></div>;
  }
  return <div className="rounded-lg border bg-muted/20 p-4 text-sm"><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-medium">Provider descriptor</p><span className="rounded-full border px-2 py-0.5 text-xs text-muted-foreground">valid</span></div><p className="mt-1 break-all font-mono text-xs text-muted-foreground">{descriptor.path}</p><div className="mt-3 grid gap-3 sm:grid-cols-3"><ConfigurationSummary label="Published" values={descriptor.publishedCapabilities} /><ConfigurationSummary label="Applied" values={descriptor.appliedCapabilities} /><ConfigurationSummary label="Stack overrides" values={descriptor.overriddenCapabilities} /></div></div>;
}

function CapabilityProviderForm({ stack, componentId, onChanged }: { stack: string; componentId: string; onChanged(): Promise<void> }) {
  const [capability, setCapability] = useState('');
  const [contextPath, setContextPath] = useState('');
  const [description, setDescription] = useState('');
  const [artifactName, setArtifactName] = useState('');
  const [artifactPath, setArtifactPath] = useState('.');
  const [strength, setStrength] = useState<'required' | 'preferred' | 'reference'>('reference');
  const operation = useOperation();
  const submit = async (event: FormEvent) => {
    event.preventDefault(); operation.start();
    try {
      await configureCapabilityProvider({ stack, componentId, capability: capability.trim(), contextPath: contextPath.trim() || undefined, description: description.trim() || undefined, strength, artifactEcosystem: artifactName.trim() ? 'npm' : undefined, artifactName: artifactName.trim() || undefined, artifactPath: artifactName.trim() ? artifactPath.trim() || '.' : undefined });
      await onChanged(); setCapability(''); setContextPath(''); setDescription(''); setArtifactName(''); setArtifactPath('.'); operation.succeed('Capability provider saved.');
    } catch (error) { operation.fail(error); }
  };
  return <form onSubmit={(event) => void submit(event)} className="space-y-3 rounded-lg border p-4"><h3 className="font-medium">Provides</h3><p className="text-xs text-muted-foreground">Publish an authoritative capability, its usage guide, and—when applicable—the package that carries it.</p><Field label="Capability" htmlFor="provider-capability"><Input id="provider-capability" required placeholder="ui.react.components" value={capability} onChange={(event) => setCapability(event.target.value)} /></Field><Field label="Context path" htmlFor="provider-context"><Input id="provider-context" placeholder="docs/components.md" value={contextPath} onChange={(event) => setContextPath(event.target.value)} /></Field><Field label="Description" htmlFor="provider-description"><Input id="provider-description" value={description} onChange={(event) => setDescription(event.target.value)} /></Field><StrengthSelect id="provider-strength" value={strength} onChange={setStrength} /><div className="border-t pt-3"><p className="text-sm font-medium">Optional npm artifact</p><p className="mt-1 text-xs text-muted-foreground">Portable package identity. Agents preserve existing registry or workspace conventions and use a local file dependency only as a fallback.</p></div><Field label="Package name" htmlFor="provider-artifact-name"><Input id="provider-artifact-name" placeholder="@acme/ui" value={artifactName} onChange={(event) => setArtifactName(event.target.value)} /></Field><Field label="Package root" htmlFor="provider-artifact-path"><Input id="provider-artifact-path" disabled={!artifactName.trim()} placeholder="." value={artifactPath} onChange={(event) => setArtifactPath(event.target.value)} /></Field><Button type="submit" size="sm" disabled={operation.pending || !componentId || !capability.trim()}>{operation.pending ? <Loader2 className="animate-spin" /> : <Plus />}Save provider</Button><OperationMessage operation={operation} /></form>;
}

function CapabilityRequirementForm({ stack, componentId, components, onChanged }: { stack: string; componentId: string; components: ComponentListOutput; onChanged(): Promise<void> }) {
  const [capability, setCapability] = useState('');
  const [from, setFrom] = useState('');
  const [optional, setOptional] = useState(false);
  const operation = useOperation();
  const submit = async (event: FormEvent) => {
    event.preventDefault(); operation.start();
    try {
      await configureCapabilityRequirement({ stack, componentId, capability: capability.trim(), from: from || undefined, optional });
      await onChanged(); setCapability(''); setFrom(''); setOptional(false); operation.succeed('Capability requirement saved.');
    } catch (error) { operation.fail(error); }
  };
  return <form onSubmit={(event) => void submit(event)} className="space-y-3 rounded-lg border p-4"><h3 className="font-medium">Consumes</h3><p className="text-xs text-muted-foreground">Connect this component to an authoritative provider.</p><Field label="Capability" htmlFor="consumer-capability"><Input id="consumer-capability" required placeholder="ui.react.components" value={capability} onChange={(event) => setCapability(event.target.value)} /></Field><Field label="Provider" htmlFor="consumer-provider"><select id="consumer-provider" value={from} onChange={(event) => setFrom(event.target.value)} className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"><option value="">Infer only if unique</option>{components.components.filter((item) => item.component.id !== componentId).map(({ component }) => <option key={component.id} value={component.id}>{component.name ?? component.id}</option>)}</select></Field><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={optional} onChange={(event) => setOptional(event.target.checked)} />Optional requirement</label><Button type="submit" size="sm" disabled={operation.pending || !componentId || !capability.trim()}>{operation.pending ? <Loader2 className="animate-spin" /> : <Plus />}Save requirement</Button><OperationMessage operation={operation} /></form>;
}

function GuidanceForm({ stack, componentId, onChanged }: { stack: string; componentId: string; onChanged(): Promise<void> }) {
  const [guidancePath, setGuidancePath] = useState('');
  const [description, setDescription] = useState('');
  const [strength, setStrength] = useState<'required' | 'preferred' | 'reference'>('required');
  const operation = useOperation();
  const submit = async (event: FormEvent) => {
    event.preventDefault(); operation.start();
    try {
      await configureComponentGuidance({ stack, componentId, path: guidancePath.trim(), description: description.trim() || undefined, strength });
      await onChanged(); setGuidancePath(''); setDescription(''); operation.succeed('Guidance saved.');
    } catch (error) { operation.fail(error); }
  };
  return <form onSubmit={(event) => void submit(event)} className="space-y-3 rounded-lg border p-4"><h3 className="font-medium">Guidance</h3><p className="text-xs text-muted-foreground">Expose a readable file relative to this component.</p><Field label="Relative path" htmlFor="guidance-path"><Input id="guidance-path" required placeholder="docs/engineering.md" value={guidancePath} onChange={(event) => setGuidancePath(event.target.value)} /></Field><Field label="Description" htmlFor="guidance-description"><Input id="guidance-description" value={description} onChange={(event) => setDescription(event.target.value)} /></Field><StrengthSelect id="guidance-strength" value={strength} onChange={setStrength} /><Button type="submit" size="sm" disabled={operation.pending || !componentId || !guidancePath.trim()}>{operation.pending ? <Loader2 className="animate-spin" /> : <Plus />}Save guidance</Button><OperationMessage operation={operation} /></form>;
}

function StrengthSelect({ id, value, onChange }: { id: string; value: 'required' | 'preferred' | 'reference'; onChange(value: 'required' | 'preferred' | 'reference'): void }) {
  return <Field label="Strength" htmlFor={id}><select id={id} value={value} onChange={(event) => onChange(event.target.value as 'required' | 'preferred' | 'reference')} className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"><option value="required">Required</option><option value="preferred">Preferred</option><option value="reference">Reference</option></select></Field>;
}

function ConfigurationSummary({ label, values }: { label: string; values: string[] }) {
  return <div><p className="font-medium">{label}</p>{values.length ? <ul className="mt-2 space-y-1 text-muted-foreground">{values.map((value) => <li key={value} className="break-all">{value}</li>)}</ul> : <p className="mt-2 text-muted-foreground">None configured</p>}</div>;
}

function CreateStackForm({
  onCreated,
}: {
  onCreated(stack: string): Promise<void>;
}) {
  const [selector, setSelector] = useState('');
  const operation = useOperation();
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    operation.start();
    try {
      await createStack(selector.trim());
      await onCreated(selector.trim()).catch(() => undefined);
      setSelector('');
      operation.succeed('Stack created.');
    } catch (error) {
      operation.fail(error);
    }
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle>Create a Stack</CardTitle>
        <CardDescription>
          Create a readable definition in the machine catalog. This does not
          create or move project directories.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={(event) => void submit(event)}
          className="flex flex-col gap-3 sm:flex-row sm:items-end"
        >
          <Field
            className="flex-1"
            label="Namespace/name"
            htmlFor="new-stack-selector"
          >
            <Input
              id="new-stack-selector"
              required
              pattern="[^/]+/[^/]+"
              placeholder="your-name/my-stack"
              value={selector}
              onChange={(event) => setSelector(event.target.value)}
            />
          </Field>
          <Button
            type="submit"
            disabled={operation.pending || !selector.trim()}
          >
            {operation.pending ? (
              <Loader2 className="animate-spin" />
            ) : (
              <Plus />
            )}
            Create Stack
          </Button>
        </form>
        <OperationMessage operation={operation} />
      </CardContent>
    </Card>
  );
}

function AddComponentForm({
  stack,
  onChanged,
}: {
  stack: string;
  onChanged(): Promise<void>;
}) {
  const [id, setId] = useState('');
  const [name, setName] = useState('');
  const [kind, setKind] = useState('component');
  const [path, setPath] = useState('');
  const [git, setGit] = useState('');
  const operation = useOperation();
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    operation.start();
    try {
      const result = await addComponent({
        stack,
        id: id.trim(),
        path: path.trim(),
        name: name.trim() || undefined,
        kind: kind.trim() || undefined,
        git: git.trim() || undefined,
      });
      setId('');
      setName('');
      setKind('component');
      setPath('');
      setGit('');
      await onChanged().catch(() => undefined);
      operation.succeed(
        result.sync.action === 'error'
          ? `Component added, but repository setup needs attention: ${result.sync.message}`
          : `Added ${id.trim() || 'component'}. ${result.sync.message}`,
      );
    } catch (error) {
      operation.fail(error);
    }
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle>Add a component</CardTitle>
        <CardDescription>
          Attach an existing directory, or provide a Git URL to clone into an
          explicit missing directory.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={(event) => void submit(event)} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Component ID" htmlFor="component-id">
              <Input
                id="component-id"
                required
                placeholder="app"
                value={id}
                onChange={(event) => setId(event.target.value)}
              />
            </Field>
            <Field label="Display name" htmlFor="component-name">
              <Input
                id="component-name"
                placeholder="Customer portal"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </Field>
          </div>
          <Field label="Directory on this machine" htmlFor="component-path">
            <Input
              id="component-path"
              required
              placeholder="/work/customer-portal"
              value={path}
              onChange={(event) => setPath(event.target.value)}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Kind" htmlFor="component-kind">
              <Input
                id="component-kind"
                placeholder="component"
                value={kind}
                onChange={(event) => setKind(event.target.value)}
              />
            </Field>
            <Field label="Git URL (optional)" htmlFor="component-git">
              <Input
                id="component-git"
                placeholder="https://github.com/org/repo.git or git@github.com:org/repo.git"
                value={git}
                onChange={(event) => setGit(event.target.value)}
              />
            </Field>
          </div>
          <Button
            type="submit"
            disabled={operation.pending || !id.trim() || !path.trim()}
          >
            {operation.pending ? (
              <Loader2 className="animate-spin" />
            ) : (
              <Plus />
            )}
            Add component
          </Button>
        </form>
        <OperationMessage operation={operation} />
      </CardContent>
    </Card>
  );
}

function BindingForm({
  stack,
  overview,
  onChanged,
}: {
  stack: string;
  overview: StackOverview;
  onChanged(): Promise<void>;
}) {
  const [componentId, setComponentId] = useState(
    overview.components[0]?.id ?? '',
  );
  const [path, setPath] = useState(overview.components[0]?.root ?? '');
  const operation = useOperation();
  useEffect(() => {
    const component =
      overview.components.find((item) => item.id === componentId) ??
      overview.components[0];
    setComponentId(component?.id ?? '');
    setPath(component?.root ?? '');
  }, [componentId, overview]);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    operation.start();
    try {
      const result = await bindComponent({
        stack,
        componentId,
        path: path.trim(),
      });
      await onChanged().catch(() => undefined);
      operation.succeed(
        result.sync.action === 'error'
          ? `Binding updated, but repository setup needs attention: ${result.sync.message}`
          : `Updated ${componentId}. ${result.sync.message}`,
      );
    } catch (error) {
      operation.fail(error);
    }
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle>Change a binding</CardTitle>
        <CardDescription>
          Point an existing component at a different explicit directory. Stacks
          never moves the repository.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {overview.components.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Add a component before configuring bindings.
          </p>
        ) : (
          <form onSubmit={(event) => void submit(event)} className="space-y-4">
            <Field label="Component" htmlFor="binding-component">
              <select
                id="binding-component"
                value={componentId}
                onChange={(event) => {
                  const id = event.target.value;
                  setComponentId(id);
                  setPath(
                    overview.components.find((item) => item.id === id)?.root ??
                      '',
                  );
                }}
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
              >
                <option value="" disabled>
                  Select a component
                </option>
                {overview.components.map((component) => (
                  <option key={component.id} value={component.id}>
                    {component.name} ({component.id})
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Directory on this machine" htmlFor="binding-path">
              <Input
                id="binding-path"
                required
                value={path}
                onChange={(event) => setPath(event.target.value)}
              />
            </Field>
            <Button
              type="submit"
              disabled={operation.pending || !componentId || !path.trim()}
            >
              {operation.pending ? <Loader2 className="animate-spin" /> : null}
              Update binding
            </Button>
          </form>
        )}
        <OperationMessage operation={operation} />
      </CardContent>
    </Card>
  );
}

interface OperationState {
  pending: boolean;
  success?: string;
  error?: string;
  start(): void;
  succeed(value: string): void;
  fail(error: unknown): void;
}
function useOperation(): OperationState {
  const [pending, setPending] = useState(false);
  const [success, setSuccess] = useState<string>();
  const [error, setError] = useState<string>();
  return {
    pending,
    success,
    error,
    start: () => {
      setPending(true);
      setSuccess(undefined);
      setError(undefined);
    },
    succeed: (value) => {
      setPending(false);
      setSuccess(value);
    },
    fail: (caught) => {
      setPending(false);
      setError(message(caught));
    },
  };
}
function OperationMessage({ operation }: { operation: OperationState }) {
  if (operation.error)
    return (
      <Alert variant="destructive" className="mt-4">
        <AlertCircle />
        <AlertTitle>Could not save</AlertTitle>
        <AlertDescription>{operation.error}</AlertDescription>
      </Alert>
    );
  if (operation.success)
    return (
      <Alert className="mt-4">
        <CheckCircle2 />
        <AlertTitle>Saved</AlertTitle>
        <AlertDescription>{operation.success}</AlertDescription>
      </Alert>
    );
  return null;
}
function Field({
  label,
  htmlFor,
  className,
  children,
}: {
  label: string;
  htmlFor: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={className}>
      <Label htmlFor={htmlFor} className="mb-1.5">
        {label}
      </Label>
      {children}
    </div>
  );
}
function ManagementSkeleton() {
  return (
    <div className="grid gap-6 xl:grid-cols-2">
      {[0, 1].map((item) => (
        <Card key={item}>
          <CardHeader>
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-4 w-72 max-w-full" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-28" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
