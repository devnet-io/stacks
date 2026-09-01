'use client';

import { List, Network, Plus } from 'lucide-react';
import { useState } from 'react';
import type { StackOverview as StackOverviewData } from '../../../src/application/overview.ts';
import {
  ComponentManagementPanel,
  StackAddPanel,
} from '@/components/stack-management';
import { StackGraph } from '@/components/stack-graph';
import { StackOverview } from '@/components/stack-overview';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';

type ComponentView = 'list' | 'graph';

export function StackComponents({
  stack,
  onOverviewLoaded,
  onCatalogChanged,
}: {
  stack: string;
  onOverviewLoaded(data: StackOverviewData): void;
  onCatalogChanged(stack?: string): Promise<void>;
}) {
  const [view, setView] = useState<ComponentView>('list');
  const [selectedComponentId, setSelectedComponentId] = useState<string>();
  const [addOpen, setAddOpen] = useState(false);
  const [revision, setRevision] = useState(0);
  const changed = async () => {
    setRevision((value) => value + 1);
    await onCatalogChanged(stack);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-2">
        <div
          className="flex items-center rounded-lg bg-muted p-1"
          aria-label="Component view"
        >
          <ViewButton active={view === 'list'} onClick={() => setView('list')}>
            <List />
            List
          </ViewButton>
          <ViewButton
            active={view === 'graph'}
            onClick={() => setView('graph')}
          >
            <Network />
            Graph
          </ViewButton>
        </div>
        <Button size="sm" onClick={() => setAddOpen(true)}>
          <Plus />
          Add
        </Button>
      </div>

      {view === 'list' ? (
        <StackOverview
          key={`list-${revision}`}
          stack={stack}
          onLoaded={onOverviewLoaded}
          onSelectComponent={setSelectedComponentId}
        />
      ) : (
        <StackGraph
          key={`graph-${revision}`}
          stack={stack}
          onSelectComponent={setSelectedComponentId}
        />
      )}

      <Sheet
        open={Boolean(selectedComponentId)}
        onOpenChange={(open) => {
          if (!open) setSelectedComponentId(undefined);
        }}
      >
        <SheetContent className="w-[min(94vw,64rem)] overflow-y-auto sm:max-w-4xl">
          <SheetHeader className="border-b pr-14">
            <SheetTitle>Component details</SheetTitle>
            <SheetDescription>
              Inspect and edit this component, its local binding, capabilities,
              relationships, and guidance.
            </SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-8">
            {selectedComponentId ? (
              <ComponentManagementPanel
                key={`${selectedComponentId}-${revision}`}
                stack={stack}
                componentId={selectedComponentId}
                onChanged={changed}
              />
            ) : null}
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={addOpen} onOpenChange={setAddOpen}>
        <SheetContent className="w-[min(94vw,42rem)] overflow-y-auto sm:max-w-2xl">
          <SheetHeader className="border-b pr-14">
            <SheetTitle>Add to Stacks</SheetTitle>
            <SheetDescription>
              Attach a component to this Stack or create another Stack in the
              machine catalog.
            </SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-8">
            <StackAddPanel
              stack={stack}
              onCatalogChanged={async (nextStack) => {
                setRevision((value) => value + 1);
                await onCatalogChanged(nextStack);
              }}
            />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function ViewButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick(): void;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant={active ? 'secondary' : 'ghost'}
      aria-pressed={active}
      onClick={onClick}
      className={active ? 'bg-background shadow-sm' : undefined}
    >
      {children}
    </Button>
  );
}
