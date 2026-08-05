import { fireEvent, render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { EdgeInspector } from '@/components/graph/edge-inspector';
import { GraphCanvas, type SelectedEdge } from '@/components/graph/graph-canvas';
import { EMPTY_FILTERS, GraphControls } from '@/components/graph/graph-controls';
import { GRAPH_LAYOUTS, LAYOUT_LABELS } from '@/components/graph/layouts';
import { ThemeProvider } from '@/hooks/use-theme';
import type { GraphEdgeView, GraphNodeView, GraphView } from '@/types/api';

/**
 * Mount tests for the visualization components.
 *
 * jsdom returns null from `canvas.getContext('2d')`, so nothing is painted here
 * — that is exactly the point. These prove the component tree mounts, the
 * controls are wired and labelled, and the renderer degrades without a 2D
 * context instead of throwing. Pixel output needs a real browser.
 */

const nodes: GraphNodeView[] = [
  {
    elementId: 'e-a',
    id: 'author-1',
    label: 'Author',
    name: 'Ada Okafor',
    caption: 'Professor',
    degree: 4,
    properties: { hIndex: 34 },
  },
  {
    elementId: 'e-p',
    id: 'paper-1',
    label: 'Paper',
    name: 'Sparse Routing',
    caption: '2019',
    degree: 2,
    properties: {},
  },
];

const edges: GraphEdgeView[] = [
  {
    elementId: 'edge-1',
    type: 'AUTHORED',
    source: 'e-a',
    target: 'e-p',
    properties: { position: 1 },
  },
];

const view: GraphView = {
  nodes,
  edges,
  stats: {
    nodeCount: 2,
    edgeCount: 1,
    truncated: false,
    labelCounts: [
      { label: 'Author', count: 1 },
      { label: 'Paper', count: 1 },
    ],
    relationshipCounts: [{ type: 'AUTHORED', count: 1 }],
  },
};

function renderCanvas(props: Partial<ComponentProps<typeof GraphCanvas>> = {}) {
  return render(
    <ThemeProvider>
      <GraphCanvas nodes={nodes} edges={edges} {...props} />
    </ThemeProvider>,
  );
}

describe('GraphCanvas', () => {
  it('mounts and degrades gracefully without a 2D context', () => {
    renderCanvas();
    expect(screen.getByRole('application')).toBeInTheDocument();
  });

  it('describes the graph and its keyboard affordances to assistive tech', () => {
    renderCanvas();

    const canvas = screen.getByRole('application');
    expect(canvas).toHaveAttribute(
      'aria-label',
      expect.stringContaining('2 nodes and 1 relationships'),
    );
    // The keys must be discoverable without sighted trial and error.
    expect(canvas.getAttribute('aria-label')).toMatch(/arrow keys/i);
    expect(canvas).toHaveAttribute('tabindex', '0');
  });

  it('exposes viewport and export controls with accessible names', () => {
    renderCanvas();

    for (const name of [
      /zoom in/i,
      /zoom out/i,
      /fit to view/i,
      /restart layout/i,
      /export graph as png/i,
      /fullscreen/i,
    ]) {
      expect(screen.getByRole('button', { name }), `${name} control missing`).toBeInTheDocument();
    }
  });

  it('clears the selection on Escape', () => {
    const onSelect = vi.fn();
    const onSelectEdge = vi.fn();
    renderCanvas({ onSelect, onSelectEdge, selectedElementId: 'e-a' });

    fireEvent.keyDown(screen.getByRole('application'), { key: 'Escape' });

    expect(onSelect).toHaveBeenCalledWith(null);
    expect(onSelectEdge).toHaveBeenCalledWith(null);
  });

  it('renders an empty state rather than a blank canvas', () => {
    render(
      <ThemeProvider>
        <GraphCanvas nodes={[]} edges={[]} />
      </ThemeProvider>,
    );
    expect(screen.getByText(/no nodes to display/i)).toBeInTheDocument();
  });
});

describe('GraphControls', () => {
  const setup = () => {
    const onFiltersChange = vi.fn();
    const onLayoutChange = vi.fn();
    const onReset = vi.fn();

    render(
      <GraphControls
        view={view}
        filters={EMPTY_FILTERS}
        onFiltersChange={onFiltersChange}
        layout="force"
        onLayoutChange={onLayoutChange}
        depth={1}
        onDepthChange={vi.fn()}
        onReset={onReset}
      />,
    );

    return { onFiltersChange, onLayoutChange, onReset };
  };

  it('offers every layout', () => {
    setup();
    for (const layout of GRAPH_LAYOUTS) {
      expect(screen.getByRole('option', { name: LAYOUT_LABELS[layout] })).toBeInTheDocument();
    }
  });

  it('labels the search, layout and depth inputs', () => {
    setup();
    expect(screen.getByLabelText(/find a node/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/layout/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/expansion depth/i)).toBeInTheDocument();
  });

  it('reveals type filters derived from the loaded graph', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: /filters/i }));

    // Only types actually present are offered - never a filter that returns nothing.
    expect(screen.getByRole('button', { name: /Author/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /authored/ })).toBeInTheDocument();
    expect(screen.getByLabelText(/hide isolated nodes/i)).toBeInTheDocument();
  });

  it('reports a filter change without mutating the caller state', () => {
    const { onFiltersChange } = setup();
    fireEvent.change(screen.getByLabelText(/find a node/i), { target: { value: 'a' } });

    expect(onFiltersChange).toHaveBeenCalledWith(expect.objectContaining({ query: 'a' }));
    expect(EMPTY_FILTERS.query).toBe('');
  });
});

describe('EdgeInspector', () => {
  const edge: SelectedEdge = {
    elementId: 'edge-1',
    type: 'AUTHORED',
    source: nodes[0] as GraphNodeView,
    target: nodes[1] as GraphNodeView,
    properties: { position: 1 },
  };

  it('explains what the relationship asserts, not just its name', () => {
    render(
      <MemoryRouter>
        <EdgeInspector edge={edge} />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'AUTHORED' })).toBeInTheDocument();
    expect(screen.getByText(/credited author/i)).toBeInTheDocument();
  });

  it('shows both endpoints with their direction', () => {
    render(
      <MemoryRouter>
        <EdgeInspector edge={edge} />
      </MemoryRouter>,
    );

    expect(screen.getByText('From')).toBeInTheDocument();
    expect(screen.getByText('To')).toBeInTheDocument();
    expect(screen.getByText('Ada Okafor')).toBeInTheDocument();
    expect(screen.getByText('Sparse Routing')).toBeInTheDocument();
  });

  it('renders relationship properties, which are the point of a property graph', () => {
    render(
      <MemoryRouter>
        <EdgeInspector edge={edge} />
      </MemoryRouter>,
    );
    expect(screen.getByText('Position')).toBeInTheDocument();
  });

  it('says so plainly when a relationship carries no properties', () => {
    render(
      <MemoryRouter>
        <EdgeInspector edge={{ ...edge, properties: {} }} />
      </MemoryRouter>,
    );
    expect(screen.getByText(/no properties of its own/i)).toBeInTheDocument();
  });

  it('renders nothing when no edge is selected', () => {
    const { container } = render(
      <MemoryRouter>
        <EdgeInspector edge={null} />
      </MemoryRouter>,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
