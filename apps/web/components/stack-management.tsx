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
  createStack,
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
  const [loading, setLoading] = useState(Boolean(stack));
  const [loadError, setLoadError] = useState<string>();
  const load = useCallback(async () => {
    if (!stack) {
      setOverview(undefined);
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(undefined);
    try {
      setOverview(await fetchOverview(stack));
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
      ) : overview ? (
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
      ) : null}
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
