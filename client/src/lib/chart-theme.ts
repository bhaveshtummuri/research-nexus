/**
 * Shared Recharts styling.
 *
 * Charts read their colours from the same CSS custom properties as the rest of
 * the app, so switching theme restyles every chart without a re-render or a
 * second palette to maintain.
 */
export const chartTheme = {
  grid: {
    stroke: 'hsl(var(--border))',
    strokeDasharray: '3 3',
    vertical: false,
  },
  axis: {
    stroke: 'hsl(var(--muted-foreground))',
    fontSize: 11,
    tickLine: false,
    axisLine: false,
    tick: { fill: 'hsl(var(--muted-foreground))' },
  },
  tooltip: {
    contentStyle: {
      background: 'hsl(var(--surface-raised))',
      border: '1px solid hsl(var(--border))',
      borderRadius: 'var(--radius)',
      fontSize: 12,
      boxShadow: '0 24px 48px -12px hsl(var(--shadow) / 0.55)',
    },
    labelStyle: { color: 'hsl(var(--foreground))', fontWeight: 600, marginBottom: 4 },
    itemStyle: { color: 'hsl(var(--muted-foreground))' },
    cursor: { stroke: 'hsl(var(--border))' },
  },
} as const;

/** Ordered palette for categorical series, matching the graph node colours. */
export const CHART_SERIES_COLORS = [
  'hsl(var(--graph-author))',
  'hsl(var(--graph-paper))',
  'hsl(var(--graph-topic))',
  'hsl(var(--graph-university))',
  'hsl(var(--graph-conference))',
  'hsl(var(--graph-journal))',
  'hsl(var(--graph-dataset))',
  'hsl(var(--graph-funding))',
  'hsl(var(--graph-project))',
  'hsl(var(--graph-keyword))',
] as const;
