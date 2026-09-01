export type AppSection =
  | 'components'
  | 'activity'
  | 'requests'
  | 'documentation'
  | 'integrations';

const sections = new Set<AppSection>([
  'components',
  'activity',
  'requests',
  'documentation',
  'integrations',
]);

export function sectionFromView(value: string | null): AppSection {
  if (value === 'overview' || value === 'graph' || value === 'management') {
    return 'components';
  }
  return value && sections.has(value as AppSection)
    ? (value as AppSection)
    : 'documentation';
}
