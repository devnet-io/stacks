import {
  AlertCircle,
  ArrowLeft,
  BookOpen,
  Boxes,
  CheckCircle2,
  Loader2,
  Network,
  Plus,
  RefreshCw,
  Settings2,
  Trash2,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  addComponent,
  bindComponent,
  configureCapabilityProvider,
  configureCapabilityRequirement,
  configureComponentGuidance,
  createStack,
  fetchComponents,
  fetchOverview,
  removeCapabilityProvider,
  removeCapabilityRequirement,
  removeComponentGuidance,
  renameCapability,
  updateComponent,
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
          <div className="grid gap-6 xl:grid-cols-3">
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
            <ComponentMetadataForm
              stack={stack}
              components={components}
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

export function StackAddPanel({
  stack,
  onCatalogChanged,
}: {
  stack?: string;
  onCatalogChanged(stack?: string): Promise<void>;
}) {
  return (
    <div className="space-y-5">
      {stack ? (
        <AddComponentForm
          stack={stack}
          onChanged={() => onCatalogChanged(stack)}
        />
      ) : null}
      <CreateStackForm onCreated={onCatalogChanged} />
    </div>
  );
}

export function ComponentManagementPanel({
  stack,
  componentId,
  onBack,
  onChanged,
}: {
  stack: string;
  componentId: string;
  onBack(): void;
  onChanged(): Promise<void>;
}) {
  const [overview, setOverview] = useState<StackOverview>();
  const [components, setComponents] = useState<ComponentListOutput>();
  const [error, setError] = useState<string>();
  const load = useCallback(async () => {
    setError(undefined);
    try {
      const [nextOverview, nextComponents] = await Promise.all([
        fetchOverview(stack),
        fetchComponents(stack),
      ]);
      setOverview(nextOverview);
      setComponents(nextComponents);
    } catch (caught) {
      setError(message(caught));
    }
  }, [stack]);
  useEffect(() => {
    void load();
  }, [load]);
  const changed = async () => {
    await load();
    await onChanged();
  };
  if (error && !components) {
    return (
      <Alert variant="destructive">
        <AlertCircle />
        <AlertTitle>Could not load component details</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }
  if (!overview || !components) return <ManagementSkeleton />;
  const entry = components.components.find(
    (item) => item.component.id === componentId,
  );
  const health = overview.components.find((item) => item.id === componentId);
  if (!entry || !health)
    return (
      <Alert variant="destructive">
        <AlertCircle />
        <AlertTitle>Component not found</AlertTitle>
        <AlertDescription>
          This component may have been removed since the view was opened.
        </AlertDescription>
      </Alert>
    );
  const component = entry.component;
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="-ml-2"
        onClick={onBack}
      >
        <ArrowLeft /> Back to Components
      </Button>
      <header className="flex flex-wrap items-start justify-between gap-5 border-b pb-6">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              {component.kind}
            </span>
            <span className="rounded-full border px-2 py-0.5 text-xs text-muted-foreground">
              {health.health}
            </span>
          </div>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight">
            {component.name ?? component.id}
          </h2>
          <p className="mt-1 font-mono text-xs text-muted-foreground">
            {component.id}
          </p>
          {component.description ? (
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
              {component.description}
            </p>
          ) : null}
        </div>
        <div className="max-w-md rounded-lg border bg-muted/20 px-3 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-[.12em] text-muted-foreground">
            Local binding
          </p>
          <p className="mt-1 break-all font-mono text-xs leading-5">
            {health.root}
          </p>
        </div>
      </header>
      <Tabs defaultValue="overview" className="gap-6">
        <TabsList
          variant="line"
          className="w-full justify-start overflow-x-auto border-b pb-1"
        >
          <TabsTrigger value="overview" className="flex-none px-3 py-2">
            <Settings2 /> Overview
          </TabsTrigger>
          <TabsTrigger value="capabilities" className="flex-none px-3 py-2">
            <Boxes /> Capabilities
          </TabsTrigger>
          <TabsTrigger value="relationships" className="flex-none px-3 py-2">
            <Network /> Relationships
          </TabsTrigger>
          <TabsTrigger value="guidance" className="flex-none px-3 py-2">
            <BookOpen /> Guidance
          </TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="space-y-5">
          <SectionIntro
            title="Component identity and location"
            description="Edit portable descriptive metadata separately from this machine's explicit directory binding."
          />
          <div className="grid gap-5 lg:grid-cols-2">
            <ComponentMetadataForm
              stack={stack}
              components={components}
              fixedComponentId={componentId}
              onChanged={changed}
            />
            <BindingForm
              stack={stack}
              overview={overview}
              fixedComponentId={componentId}
              onChanged={changed}
            />
          </div>
        </TabsContent>
        <TabsContent value="capabilities" className="space-y-5">
          <SectionIntro
            title="Provided capabilities"
            description="Describe what this component authoritatively provides, including bounded context and an optional implementation artifact."
          />
          <DescriptorSummary descriptor={entry.descriptor} />
          <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(18rem,.65fr)]">
            <CapabilityProviderForm
              key={`provider-${componentId}`}
              stack={stack}
              component={component}
              descriptor={entry.descriptor}
              onChanged={changed}
            />
            <ConfigurationCard
              label="Current providers"
              values={(component.provides ?? []).map(
                (item) =>
                  `${item.capability}${item.artifact ? ` · ${item.artifact.ecosystem}:${item.artifact.name}` : ''}`,
              )}
              empty="No capabilities provided"
            />
          </div>
        </TabsContent>
        <TabsContent value="relationships" className="space-y-5">
          <SectionIntro
            title="Consumed capabilities"
            description="Connect this component to authoritative providers. Required and optional relationships remain explicit."
          />
          <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(18rem,.65fr)]">
            <CapabilityRequirementForm
              key={`requirement-${componentId}`}
              stack={stack}
              component={component}
              components={components}
              onChanged={changed}
            />
            <ConfigurationCard
              label="Current requirements"
              values={(component.consumes ?? []).map(
                (item) =>
                  `${item.capability} · ${item.optional ? 'optional' : 'required'}${item.from ? ` · from ${item.from}` : ' · inferred provider'}`,
              )}
              empty="No capabilities consumed"
            />
          </div>
        </TabsContent>
        <TabsContent value="guidance" className="space-y-5">
          <SectionIntro
            title="Component guidance"
            description="Expose bounded, readable files that agents should consult when working with this component."
          />
          <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(18rem,.65fr)]">
            <GuidanceForm
              key={`guidance-${componentId}`}
              stack={stack}
              component={component}
              onChanged={changed}
            />
            <ConfigurationCard
              label="Current guidance"
              values={(component.guidance ?? []).map(
                (item) => `${item.path} · ${item.strength ?? 'reference'}`,
              )}
              empty="No guidance configured"
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SectionIntro({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div>
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
        {description}
      </p>
    </div>
  );
}
function ConfigurationCard({
  label,
  values,
  empty,
}: {
  label: string;
  values: string[];
  empty: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{label}</CardTitle>
        <CardDescription>
          Saved Stack declarations for this component.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {values.length ? (
          <ul className="space-y-2">
            {values.map((value) => (
              <li
                key={value}
                className="rounded-lg border bg-muted/20 px-3 py-2 font-mono text-xs leading-5"
              >
                {value}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">{empty}</p>
        )}
      </CardContent>
    </Card>
  );
}

function ContextConfiguration({
  stack,
  components,
  fixedComponentId,
  onChanged,
}: {
  stack: string;
  components: ComponentListOutput;
  fixedComponentId?: string;
  onChanged(): Promise<void>;
}) {
  const [componentId, setComponentId] = useState(
    fixedComponentId ?? components.components[0]?.component.id ?? '',
  );
  useEffect(() => {
    if (fixedComponentId) {
      setComponentId(fixedComponentId);
      return;
    }
    if (
      !components.components.some((item) => item.component.id === componentId)
    ) {
      setComponentId(components.components[0]?.component.id ?? '');
    }
  }, [componentId, components, fixedComponentId]);
  const selectedEntry = components.components.find(
    (item) => item.component.id === componentId,
  );
  const selected = selectedEntry?.component;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Context and capabilities</CardTitle>
        <CardDescription>
          Declare what a component provides, what it consumes, and which
          component-relative guidance agents should inspect.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {components.components.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Add a component before configuring agent context.
          </p>
        ) : (
          <>
            {!fixedComponentId ? (
              <Field label="Component to configure" htmlFor="context-component">
                <select
                  id="context-component"
                  value={componentId}
                  onChange={(event) => setComponentId(event.target.value)}
                  className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm sm:max-w-md"
                >
                  {components.components.map(({ component }) => (
                    <option key={component.id} value={component.id}>
                      {component.name ?? component.id} ({component.id})
                    </option>
                  ))}
                </select>
              </Field>
            ) : null}
            {selectedEntry ? (
              <DescriptorSummary descriptor={selectedEntry.descriptor} />
            ) : null}
            {selected && (
              <div className="grid gap-6 xl:grid-cols-3">
                <CapabilityProviderForm
                  key={`provider-${componentId}`}
                  stack={stack}
                  component={selected}
                  descriptor={selectedEntry!.descriptor}
                  onChanged={onChanged}
                />
                <CapabilityRequirementForm
                  key={`requirement-${componentId}`}
                  stack={stack}
                  component={selected}
                  components={components}
                  onChanged={onChanged}
                />
                <GuidanceForm
                  key={`guidance-${componentId}`}
                  stack={stack}
                  component={selected}
                  onChanged={onChanged}
                />
              </div>
            )}
            {selected && (
              <div className="grid gap-4 border-t pt-5 text-sm md:grid-cols-3">
                <ConfigurationSummary
                  label="Provides"
                  values={(selected.provides ?? []).map(
                    (item) =>
                      `${item.capability}${item.artifact ? ` · ${item.artifact.ecosystem}:${item.artifact.name} · root ${item.artifact.path ?? '.'}` : ''}`,
                  )}
                />
                <ConfigurationSummary
                  label="Consumes"
                  values={(selected.consumes ?? []).map(
                    (item) =>
                      `${item.capability} · ${item.optional ? 'optional' : 'required'}${item.from ? ` · from ${item.from}` : ' · provider inferred only when unique'}`,
                  )}
                />
                <ConfigurationSummary
                  label="Guidance"
                  values={(selected.guidance ?? []).map(
                    (item) => `${item.path} · ${item.strength ?? 'reference'}`,
                  )}
                />
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function DescriptorSummary({
  descriptor,
}: {
  descriptor: ComponentDescriptorReport;
}) {
  if (descriptor.status === 'invalid' || descriptor.status === 'unavailable') {
    return (
      <Alert variant="destructive">
        <AlertCircle />
        <AlertTitle>Provider descriptor {descriptor.status}</AlertTitle>
        <AlertDescription>
          <p className="break-all">{descriptor.path}</p>
          <ul className="mt-2 list-disc space-y-1 pl-4">
            {descriptor.errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
          <p className="mt-2">
            Stacks ignored the descriptor and kept explicit Stack declarations
            active.
          </p>
        </AlertDescription>
      </Alert>
    );
  }
  if (descriptor.status === 'absent') {
    return (
      <div className="rounded-lg border border-dashed p-4 text-sm">
        <p className="font-medium">No provider descriptor</p>
        <p className="mt-1 text-muted-foreground">
          Optional descriptor:{' '}
          <span className="break-all font-mono text-xs">{descriptor.path}</span>
          . Explicit Stack declarations remain the complete source for this
          component.
        </p>
      </div>
    );
  }
  return (
    <div className="rounded-lg border bg-muted/20 p-4 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-medium">Provider descriptor</p>
        <span className="rounded-full border px-2 py-0.5 text-xs text-muted-foreground">
          valid
        </span>
      </div>
      <p className="mt-1 break-all font-mono text-xs text-muted-foreground">
        {descriptor.path}
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <ConfigurationSummary
          label="Published"
          values={descriptor.publishedCapabilities}
        />
        <ConfigurationSummary
          label="Applied"
          values={descriptor.appliedCapabilities}
        />
        <ConfigurationSummary
          label="Stack overrides"
          values={descriptor.overriddenCapabilities}
        />
      </div>
    </div>
  );
}

function CapabilityProviderForm({
  stack,
  component,
  descriptor,
  onChanged,
}: {
  stack: string;
  component: ComponentListOutput['components'][number]['component'];
  descriptor: ComponentDescriptorReport;
  onChanged(): Promise<void>;
}) {
  const componentId = component.id;
  const [originalCapability, setOriginalCapability] = useState('');
  const [capability, setCapability] = useState('');
  const [contextPath, setContextPath] = useState('');
  const [description, setDescription] = useState('');
  const [artifactName, setArtifactName] = useState('');
  const [artifactPath, setArtifactPath] = useState('.');
  const [strength, setStrength] = useState<
    'required' | 'preferred' | 'reference'
  >('reference');
  const operation = useOperation();
  const chooseExisting = (value: string) => {
    const existing = (component.provides ?? []).find(
      (item) => item.capability === value,
    );
    setOriginalCapability(value);
    setCapability(value);
    setContextPath(existing?.context?.[0]?.path ?? '');
    setDescription(existing?.description ?? '');
    setStrength(existing?.context?.[0]?.strength ?? 'reference');
    setArtifactName(existing?.artifact?.name ?? '');
    setArtifactPath(existing?.artifact?.path ?? '.');
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    operation.start();
    try {
      await configureCapabilityProvider({
        stack,
        componentId,
        capability: capability.trim(),
        contextPath: contextPath.trim() || null,
        description: description.trim() || null,
        strength,
        artifactEcosystem: artifactName.trim() ? 'npm' : undefined,
        artifactName: artifactName.trim() || null,
        artifactPath: artifactName.trim()
          ? artifactPath.trim() || '.'
          : undefined,
      });
      await onChanged();
      setOriginalCapability('');
      setCapability('');
      setContextPath('');
      setDescription('');
      setArtifactName('');
      setArtifactPath('.');
      operation.succeed('Capability provider saved.');
    } catch (error) {
      operation.fail(error);
    }
  };
  const descriptorOnly = Boolean(
    originalCapability &&
    descriptor.appliedCapabilities.includes(originalCapability) &&
    !descriptor.overriddenCapabilities.includes(originalCapability),
  );
  const renamePending = Boolean(
    originalCapability && originalCapability !== capability.trim(),
  );
  const rename = async () => {
    if (!originalCapability || !capability.trim()) return;
    operation.start();
    try {
      const replacement = capability.trim();
      await renameCapability({
        stack,
        componentId,
        capability: originalCapability,
        replacement,
      });
      await onChanged();
      setOriginalCapability(replacement);
      operation.succeed(
        'Capability and resolved consumer relationships renamed.',
      );
    } catch (error) {
      operation.fail(error);
    }
  };
  const remove = async () => {
    if (!originalCapability) return;
    operation.start();
    try {
      await removeCapabilityProvider({
        stack,
        componentId,
        capability: originalCapability,
      });
      await onChanged();
      setOriginalCapability('');
      setCapability('');
      operation.succeed('Capability provider removed.');
    } catch (error) {
      operation.fail(error);
    }
  };
  return (
    <form
      onSubmit={(event) => void submit(event)}
      className="space-y-3 rounded-lg border p-4"
    >
      <h3 className="font-medium">Provides</h3>
      <p className="text-xs text-muted-foreground">
        Publish an authoritative capability, its usage guide, and—when
        applicable—the package that carries it. Renaming updates consumer edges
        atomically. Descriptor-owned declarations must be changed in the
        component repository.
      </p>
      {(component.provides ?? []).length > 0 && (
        <Field label="Edit existing" htmlFor="provider-existing">
          <select
            id="provider-existing"
            value={originalCapability}
            onChange={(event) => chooseExisting(event.target.value)}
            className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
          >
            <option value="">New capability</option>
            {(component.provides ?? []).map((item) => (
              <option key={item.capability} value={item.capability}>
                {item.capability}
              </option>
            ))}
          </select>
        </Field>
      )}
      <Field label="Capability" htmlFor="provider-capability">
        <Input
          id="provider-capability"
          required
          placeholder="ui.react.components"
          value={capability}
          disabled={descriptorOnly}
          onChange={(event) => setCapability(event.target.value)}
        />
      </Field>
      {descriptorOnly ? (
        <p className="text-xs text-muted-foreground">
          Saving other fields creates a Stack override; rename or remove this
          declaration in{' '}
          <span className="font-mono">.stack/component.json</span>.
        </p>
      ) : renamePending ? (
        <p className="text-xs text-muted-foreground">
          Rename first so provider and consumer declarations change in one
          atomic operation; then save any metadata edits.
        </p>
      ) : null}
      <Field label="Context path" htmlFor="provider-context">
        <Input
          id="provider-context"
          placeholder="docs/components.md"
          value={contextPath}
          onChange={(event) => setContextPath(event.target.value)}
        />
      </Field>
      <Field label="Description" htmlFor="provider-description">
        <Input
          id="provider-description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
      </Field>
      <StrengthSelect
        id="provider-strength"
        value={strength}
        onChange={setStrength}
      />
      <div className="border-t pt-3">
        <p className="text-sm font-medium">Optional npm artifact</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Portable package identity. The agent must still make the dependency
          usable in the consumer; Stacks supplies workspace, registry, or
          local-file guidance.
        </p>
      </div>
      <Field label="Package name" htmlFor="provider-artifact-name">
        <Input
          id="provider-artifact-name"
          placeholder="@acme/ui"
          value={artifactName}
          onChange={(event) => setArtifactName(event.target.value)}
        />
      </Field>
      <Field label="Package root" htmlFor="provider-artifact-path">
        <Input
          id="provider-artifact-path"
          disabled={!artifactName.trim()}
          placeholder="."
          value={artifactPath}
          onChange={(event) => setArtifactPath(event.target.value)}
        />
      </Field>
      <div className="flex flex-wrap gap-2">
        <Button
          type="submit"
          size="sm"
          disabled={
            operation.pending ||
            !componentId ||
            !capability.trim() ||
            renamePending
          }
        >
          {operation.pending ? <Loader2 className="animate-spin" /> : <Plus />}
          Save provider
        </Button>
        {renamePending ? (
          <Button
            type="button"
            size="sm"
            disabled={operation.pending}
            onClick={() => void rename()}
          >
            Rename and update consumers
          </Button>
        ) : null}
        {originalCapability && !descriptorOnly && !renamePending ? (
          <Button
            type="button"
            size="sm"
            variant="destructive"
            disabled={operation.pending}
            onClick={() => void remove()}
          >
            <Trash2 />
            Remove
          </Button>
        ) : null}
      </div>
      <OperationMessage operation={operation} />
    </form>
  );
}

function CapabilityRequirementForm({
  stack,
  component,
  components,
  onChanged,
}: {
  stack: string;
  component: ComponentListOutput['components'][number]['component'];
  components: ComponentListOutput;
  onChanged(): Promise<void>;
}) {
  const componentId = component.id;
  const [editingCapability, setEditingCapability] = useState('');
  const [capability, setCapability] = useState('');
  const [from, setFrom] = useState('');
  const [optional, setOptional] = useState(false);
  const operation = useOperation();
  const chooseExisting = (value: string) => {
    const existing = (component.consumes ?? []).find(
      (item) => item.capability === value,
    );
    setEditingCapability(value);
    setCapability(value);
    setFrom(existing?.from ?? '');
    setOptional(existing?.optional ?? false);
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    operation.start();
    try {
      await configureCapabilityRequirement({
        stack,
        componentId,
        capability: capability.trim(),
        from: from || null,
        optional,
      });
      await onChanged();
      setEditingCapability('');
      setCapability('');
      setFrom('');
      setOptional(false);
      operation.succeed('Capability requirement saved.');
    } catch (error) {
      operation.fail(error);
    }
  };
  const remove = async () => {
    if (!editingCapability) return;
    operation.start();
    try {
      await removeCapabilityRequirement({
        stack,
        componentId,
        capability: editingCapability,
      });
      await onChanged();
      setEditingCapability('');
      setCapability('');
      operation.succeed('Capability requirement removed.');
    } catch (error) {
      operation.fail(error);
    }
  };
  return (
    <form
      onSubmit={(event) => void submit(event)}
      className="space-y-3 rounded-lg border p-4"
    >
      <h3 className="font-medium">Consumes</h3>
      <p className="text-xs text-muted-foreground">
        Connect this component to an authoritative provider. Requirements are
        required by default; optional unresolved requirements are warnings.
      </p>
      {(component.consumes ?? []).length > 0 && (
        <Field label="Edit existing" htmlFor="consumer-existing">
          <select
            id="consumer-existing"
            value={editingCapability}
            onChange={(event) => chooseExisting(event.target.value)}
            className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
          >
            <option value="">New requirement</option>
            {(component.consumes ?? []).map((item) => (
              <option key={item.capability} value={item.capability}>
                {item.capability} · {item.optional ? 'optional' : 'required'}
              </option>
            ))}
          </select>
        </Field>
      )}
      <Field label="Capability" htmlFor="consumer-capability">
        <Input
          id="consumer-capability"
          required
          disabled={Boolean(editingCapability)}
          placeholder="ui.react.components"
          value={capability}
          onChange={(event) => setCapability(event.target.value)}
        />
      </Field>
      <Field label="Provider" htmlFor="consumer-provider">
        <select
          id="consumer-provider"
          value={from}
          onChange={(event) => setFrom(event.target.value)}
          className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
        >
          <option value="">Infer only if unique</option>
          {components.components
            .filter((item) => item.component.id !== componentId)
            .map(({ component }) => (
              <option key={component.id} value={component.id}>
                {component.name ?? component.id}
              </option>
            ))}
        </select>
      </Field>
      <label className="flex items-start gap-2 text-sm">
        <input
          className="mt-0.5"
          type="checkbox"
          checked={optional}
          onChange={(event) => setOptional(event.target.checked)}
        />
        <span>
          <span className="block">Optional requirement</span>
          <span className="block text-xs text-muted-foreground">
            Leave unchecked when this capability is necessary for the component
            to work correctly.
          </span>
        </span>
      </label>
      <div className="flex flex-wrap gap-2">
        <Button
          type="submit"
          size="sm"
          disabled={operation.pending || !componentId || !capability.trim()}
        >
          {operation.pending ? <Loader2 className="animate-spin" /> : <Plus />}
          Save requirement
        </Button>
        {editingCapability ? (
          <Button
            type="button"
            size="sm"
            variant="destructive"
            disabled={operation.pending}
            onClick={() => void remove()}
          >
            <Trash2 />
            Remove
          </Button>
        ) : null}
      </div>
      <OperationMessage operation={operation} />
    </form>
  );
}

function GuidanceForm({
  stack,
  component,
  onChanged,
}: {
  stack: string;
  component: ComponentListOutput['components'][number]['component'];
  onChanged(): Promise<void>;
}) {
  const componentId = component.id;
  const [editingPath, setEditingPath] = useState('');
  const [guidancePath, setGuidancePath] = useState('');
  const [description, setDescription] = useState('');
  const [strength, setStrength] = useState<
    'required' | 'preferred' | 'reference'
  >('required');
  const operation = useOperation();
  const chooseExisting = (value: string) => {
    const existing = (component.guidance ?? []).find(
      (item) => item.path === value,
    );
    setEditingPath(value);
    setGuidancePath(value);
    setDescription(existing?.description ?? '');
    setStrength(existing?.strength ?? 'reference');
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    operation.start();
    try {
      await configureComponentGuidance({
        stack,
        componentId,
        path: guidancePath.trim(),
        description: description.trim() || null,
        strength,
      });
      await onChanged();
      setEditingPath('');
      setGuidancePath('');
      setDescription('');
      operation.succeed('Guidance saved.');
    } catch (error) {
      operation.fail(error);
    }
  };
  const remove = async () => {
    if (!editingPath) return;
    operation.start();
    try {
      await removeComponentGuidance({ stack, componentId, path: editingPath });
      await onChanged();
      setEditingPath('');
      setGuidancePath('');
      operation.succeed('Guidance removed.');
    } catch (error) {
      operation.fail(error);
    }
  };
  return (
    <form
      onSubmit={(event) => void submit(event)}
      className="space-y-3 rounded-lg border p-4"
    >
      <h3 className="font-medium">Guidance</h3>
      <p className="text-xs text-muted-foreground">
        Expose a readable file relative to this component.
      </p>
      {(component.guidance ?? []).length > 0 ? (
        <Field label="Edit existing" htmlFor="guidance-existing">
          <select
            id="guidance-existing"
            value={editingPath}
            onChange={(event) => chooseExisting(event.target.value)}
            className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
          >
            <option value="">New guidance</option>
            {(component.guidance ?? []).map((item) => (
              <option key={item.path} value={item.path}>
                {item.path}
              </option>
            ))}
          </select>
        </Field>
      ) : null}
      <Field label="Relative path" htmlFor="guidance-path">
        <Input
          id="guidance-path"
          required
          disabled={Boolean(editingPath)}
          placeholder="docs/engineering.md"
          value={guidancePath}
          onChange={(event) => setGuidancePath(event.target.value)}
        />
      </Field>
      <Field label="Description" htmlFor="guidance-description">
        <Input
          id="guidance-description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
      </Field>
      <StrengthSelect
        id="guidance-strength"
        value={strength}
        onChange={setStrength}
      />
      <div className="flex flex-wrap gap-2">
        <Button
          type="submit"
          size="sm"
          disabled={operation.pending || !componentId || !guidancePath.trim()}
        >
          {operation.pending ? <Loader2 className="animate-spin" /> : <Plus />}
          Save guidance
        </Button>
        {editingPath ? (
          <Button
            type="button"
            size="sm"
            variant="destructive"
            disabled={operation.pending}
            onClick={() => void remove()}
          >
            <Trash2 />
            Remove
          </Button>
        ) : null}
      </div>
      <OperationMessage operation={operation} />
    </form>
  );
}

function StrengthSelect({
  id,
  value,
  onChange,
}: {
  id: string;
  value: 'required' | 'preferred' | 'reference';
  onChange(value: 'required' | 'preferred' | 'reference'): void;
}) {
  return (
    <Field label="Strength" htmlFor={id}>
      <select
        id={id}
        value={value}
        onChange={(event) =>
          onChange(event.target.value as 'required' | 'preferred' | 'reference')
        }
        className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
      >
        <option value="required">Required</option>
        <option value="preferred">Preferred</option>
        <option value="reference">Reference</option>
      </select>
    </Field>
  );
}

function ConfigurationSummary({
  label,
  values,
}: {
  label: string;
  values: string[];
}) {
  return (
    <div>
      <p className="font-medium">{label}</p>
      {values.length ? (
        <ul className="mt-2 space-y-1 text-muted-foreground">
          {values.map((value) => (
            <li key={value} className="break-all">
              {value}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-muted-foreground">None configured</p>
      )}
    </div>
  );
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

function ComponentMetadataForm({
  stack,
  components,
  fixedComponentId,
  onChanged,
}: {
  stack: string;
  components: ComponentListOutput;
  fixedComponentId?: string;
  onChanged(): Promise<void>;
}) {
  const [componentId, setComponentId] = useState(
    fixedComponentId ?? components.components[0]?.component.id ?? '',
  );
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [kind, setKind] = useState('component');
  const [access, setAccess] = useState<'read-only' | 'read-write'>(
    'read-write',
  );
  const operation = useOperation();
  const selected = components.components.find(
    (item) => item.component.id === componentId,
  )?.component;
  useEffect(() => {
    const component =
      components.components.find(
        (item) => item.component.id === (fixedComponentId ?? componentId),
      )?.component ?? components.components[0]?.component;
    setComponentId(component?.id ?? '');
    setName(component?.name ?? '');
    setDescription(component?.description ?? '');
    setKind(component?.kind ?? 'component');
    setAccess(component?.access ?? 'read-write');
  }, [componentId, components, fixedComponentId]);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!selected) return;
    operation.start();
    try {
      await updateComponent({
        stack,
        componentId,
        name: name.trim() || null,
        description: description.trim() || null,
        kind: kind.trim(),
        access,
      });
      await onChanged();
      operation.succeed('Component details saved.');
    } catch (error) {
      operation.fail(error);
    }
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle>Edit component details</CardTitle>
        <CardDescription>
          Change descriptive metadata. The component ID is a stable Stack-local
          reference and cannot be renamed.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {components.components.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Add a component before editing its details.
          </p>
        ) : (
          <form onSubmit={(event) => void submit(event)} className="space-y-4">
            {!fixedComponentId ? (
              <Field label="Component" htmlFor="metadata-component">
                <select
                  id="metadata-component"
                  value={componentId}
                  onChange={(event) => setComponentId(event.target.value)}
                  className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
                >
                  {components.components.map(({ component }) => (
                    <option key={component.id} value={component.id}>
                      {component.name ?? component.id} ({component.id})
                    </option>
                  ))}
                </select>
              </Field>
            ) : null}
            <Field label="Stable component ID" htmlFor="metadata-id">
              <Input id="metadata-id" value={componentId} disabled />
            </Field>
            <Field label="Display name" htmlFor="metadata-name">
              <Input
                id="metadata-name"
                placeholder={componentId}
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </Field>
            <Field label="Description" htmlFor="metadata-description">
              <Input
                id="metadata-description"
                placeholder="What this component contributes"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
              <Field label="Kind" htmlFor="metadata-kind">
                <Input
                  id="metadata-kind"
                  required
                  value={kind}
                  onChange={(event) => setKind(event.target.value)}
                />
              </Field>
              <Field label="Declared access" htmlFor="metadata-access">
                <select
                  id="metadata-access"
                  value={access}
                  onChange={(event) =>
                    setAccess(event.target.value as 'read-only' | 'read-write')
                  }
                  className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
                >
                  <option value="read-write">Read and write</option>
                  <option value="read-only">Read only</option>
                </select>
                <p className="mt-1 text-xs text-muted-foreground">
                  Guidance for agents and people; Stacks does not enforce
                  operating-system permissions.
                </p>
              </Field>
            </div>
            <Button
              type="submit"
              disabled={operation.pending || !componentId || !kind.trim()}
            >
              {operation.pending ? <Loader2 className="animate-spin" /> : null}
              Save details
            </Button>
          </form>
        )}
        <OperationMessage operation={operation} />
      </CardContent>
    </Card>
  );
}

function BindingForm({
  stack,
  overview,
  fixedComponentId,
  onChanged,
}: {
  stack: string;
  overview: StackOverview;
  fixedComponentId?: string;
  onChanged(): Promise<void>;
}) {
  const [componentId, setComponentId] = useState(
    fixedComponentId ?? overview.components[0]?.id ?? '',
  );
  const [path, setPath] = useState(overview.components[0]?.root ?? '');
  const operation = useOperation();
  useEffect(() => {
    const component =
      overview.components.find(
        (item) => item.id === (fixedComponentId ?? componentId),
      ) ?? overview.components[0];
    setComponentId(component?.id ?? '');
    setPath(component?.root ?? '');
  }, [componentId, fixedComponentId, overview]);
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
            {!fixedComponentId ? (
              <Field label="Component" htmlFor="binding-component">
                <select
                  id="binding-component"
                  value={componentId}
                  onChange={(event) => {
                    const id = event.target.value;
                    setComponentId(id);
                    setPath(
                      overview.components.find((item) => item.id === id)
                        ?.root ?? '',
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
            ) : null}
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
