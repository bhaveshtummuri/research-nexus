import {
  Camera,
  Loader2,
  Maximize2,
  Minimize2,
  Minus,
  Plus,
  RotateCcw,
  Scan,
} from 'lucide-react';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { useTheme } from '@/hooks/use-theme';
import { notify } from '@/lib/notify';
import { cn, LABEL_STYLES, RELATIONSHIP_LABELS } from '@/lib/utils';
import type { GraphEdgeView, GraphNodeView } from '@/types/api';

import type { GraphLayout } from './layouts';
import { GraphMinimap } from './graph-minimap';
import {
  distanceToSegmentSquared,
  isPointVisible,
  isSegmentVisible,
  NODE_SHAPES,
  traceShape,
  visibleBounds,
} from './node-shapes';
import { useForceLayout, type LayoutEdge, type LayoutNode } from './use-force-layout';

interface GraphCanvasProps {
  nodes: GraphNodeView[];
  edges: GraphEdgeView[];
  selectedElementId?: string | null;
  selectedEdgeId?: string | null;
  /** Element ids to draw highlighted, used to trace a discovered path. */
  highlightedElementIds?: Set<string>;
  onSelect?: (node: GraphNodeView | null) => void;
  onSelectEdge?: (edge: SelectedEdge | null) => void;
  onExpand?: (node: GraphNodeView) => void;
  layout?: GraphLayout;
  isLoading?: boolean;
  className?: string;
  height?: number;
}

/** An edge with both endpoints resolved, ready for the relationship panel. */
export interface SelectedEdge {
  elementId: string;
  type: string;
  source: GraphNodeView;
  target: GraphNodeView;
  properties: Record<string, unknown>;
}

interface Viewport {
  scale: number;
  offsetX: number;
  offsetY: number;
}

const MIN_SCALE = 0.25;
const MAX_SCALE = 3.5;

/** Used when computed styles are unavailable, as in jsdom during tests. */
const FALLBACK_PALETTE = {
  dark: {
    border: '#243041',
    muted: '#8891a5',
    foreground: '#eef1f7',
    primary: '#6366f1',
    surface: '#111722',
  },
  light: {
    border: '#e2e6ee',
    muted: '#5b6478',
    foreground: '#171c26',
    primary: '#4f46e5',
    surface: '#ffffff',
  },
} as const;

/**
 * Force-directed graph rendered to a canvas.
 *
 * Canvas rather than SVG: at a few hundred nodes with edges redrawn every tick,
 * SVG creates one DOM node per element and the browser spends its frame budget
 * on layout. A single canvas repaint keeps interaction smooth on a laptop
 * trackpad, which is where this view is actually used.
 */
export function GraphCanvas({
  nodes,
  edges,
  selectedElementId,
  selectedEdgeId,
  highlightedElementIds,
  onSelect,
  onSelectEdge,
  onExpand,
  layout = 'force',
  isLoading = false,
  className,
  height = 560,
}: GraphCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ width: 0, height });
  const [viewport, setViewport] = useState<Viewport>({ scale: 1, offsetX: 0, offsetY: 0 });
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  /** Culling counts, kept in a ref so recording them never triggers a render. */
  const statsRef = useRef({ drawnNodes: 0, drawnEdges: 0 });

  const dragState = useRef<{
    mode: 'none' | 'pan' | 'node';
    node: LayoutNode | null;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
    moved: boolean;
  }>({ mode: 'none', node: null, startX: 0, startY: 0, originX: 0, originY: 0, moved: false });

  const { theme } = useTheme();

  const { nodesRef, edgesRef, version, reheat, simulation } = useForceLayout({
    width: size.width,
    height: size.height,
    nodes,
    edges,
    layout,
    rootElementId: selectedElementId ?? null,
  });

  // --- sizing ---------------------------------------------------------------

  useLayoutEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      setSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // --- coordinate helpers ---------------------------------------------------

  const toGraphCoords = useCallback(
    (clientX: number, clientY: number) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return { x: 0, y: 0 };
      return {
        x: (clientX - rect.left - viewport.offsetX) / viewport.scale,
        y: (clientY - rect.top - viewport.offsetY) / viewport.scale,
      };
    },
    [viewport],
  );

  const nodeAt = useCallback(
    (graphX: number, graphY: number): LayoutNode | null => {
      // Iterating in reverse matches painter's order, so the node drawn on top
      // is the one that receives the interaction.
      for (let index = nodesRef.current.length - 1; index >= 0; index -= 1) {
        const node = nodesRef.current[index];
        if (!node || node.x === undefined || node.y === undefined) continue;
        const dx = graphX - node.x;
        const dy = graphY - node.y;
        if (dx * dx + dy * dy <= (node.radius + 4) ** 2) return node;
      }
      return null;
    },
    [nodesRef],
  );

  /**
   * Nearest edge within the pick radius, or null.
   *
   * Nodes are tested first by the caller, so this only runs on empty canvas —
   * an edge must never steal a click from a node sitting on top of it. The
   * threshold is scaled by zoom so the target stays the same size on screen
   * rather than shrinking as the user zooms out.
   */
  const edgeAt = useCallback(
    (graphX: number, graphY: number): LayoutEdge | null => {
      const threshold = 6 / viewport.scale;
      const thresholdSquared = threshold * threshold;

      let closest: LayoutEdge | null = null;
      let closestDistance = Infinity;

      for (const edge of edgesRef.current) {
        const source = edge.source as LayoutNode;
        const target = edge.target as LayoutNode;
        if (source.x === undefined || target.x === undefined) continue;

        const distance = distanceToSegmentSquared(
          graphX,
          graphY,
          source.x,
          source.y ?? 0,
          target.x,
          target.y ?? 0,
        );

        if (distance <= thresholdSquared && distance < closestDistance) {
          closestDistance = distance;
          closest = edge;
        }
      }

      return closest;
    },
    [edgesRef, viewport.scale],
  );

  const emitEdgeSelection = useCallback(
    (edge: LayoutEdge | null) => {
      if (!edge) {
        onSelectEdge?.(null);
        return;
      }
      const source = edge.source as LayoutNode;
      const target = edge.target as LayoutNode;
      const original = edges.find((candidate) => candidate.elementId === edge.elementId);

      onSelectEdge?.({
        elementId: edge.elementId,
        type: edge.type,
        source,
        target,
        properties: original?.properties ?? {},
      });
    },
    [edges, onSelectEdge],
  );

  // --- rendering ------------------------------------------------------------

  /**
   * Canvas cannot use CSS variables, so the palette is resolved to concrete
   * colours. Recomputing on theme change is what keeps the graph in step with
   * the rest of the UI when the user toggles light and dark.
   */
  const styles = useMemo(() => {
    if (typeof window === 'undefined') return FALLBACK_PALETTE[theme];
    const computed = getComputedStyle(document.documentElement);
    const read = (token: string) => `hsl(${computed.getPropertyValue(token).trim()})`;
    return {
      border: read('--border'),
      muted: read('--muted-foreground'),
      foreground: read('--foreground'),
      primary: read('--primary'),
      surface: read('--surface'),
    };
  }, [theme]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context || size.width === 0) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = size.width * dpr;
    canvas.height = size.height * dpr;

    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, size.width, size.height);
    context.translate(viewport.offsetX, viewport.offsetY);
    context.scale(viewport.scale, viewport.scale);

    const hasHighlight = Boolean(highlightedElementIds && highlightedElementIds.size > 0);
    const activeId = hoveredId ?? selectedElementId ?? null;

    // Neighbours of the active node stay fully opaque so the local structure
    // reads clearly while the rest of the graph recedes.
    const neighbourIds = new Set<string>();
    if (activeId) {
      for (const edge of edgesRef.current) {
        const source = edge.source as LayoutNode;
        const target = edge.target as LayoutNode;
        if (source.elementId === activeId) neighbourIds.add(target.elementId);
        if (target.elementId === activeId) neighbourIds.add(source.elementId);
      }
    }

    /**
     * Viewport culling.
     *
     * Everything outside the visible region is skipped before any drawing call.
     * The canvas would clip it anyway, but clipping still costs a path
     * construction and a rasterisation attempt per element — at a few thousand
     * edges that is the difference between a smooth pan and a stuttering one.
     */
    const bounds = visibleBounds(
      size.width,
      size.height,
      viewport.scale,
      viewport.offsetX,
      viewport.offsetY,
    );

    /**
     * Level of detail.
     *
     * Zoomed out, text is unreadable and shape differences vanish, so both are
     * dropped: the graph becomes a density map, which is the only thing legible
     * at that scale anyway.
     */
    const showNodeLabels = viewport.scale > 0.75;
    const showEdgeLabels = viewport.scale > 1.35;
    const showShapes = viewport.scale > 0.4;

    let drawnNodes = 0;
    let drawnEdges = 0;

    // --- edges ---
    context.lineWidth = 1 / viewport.scale;
    for (const edge of edgesRef.current) {
      const source = edge.source as LayoutNode;
      const target = edge.target as LayoutNode;
      if (source.x === undefined || target.x === undefined) continue;

      const sourceY = source.y ?? 0;
      const targetY = target.y ?? 0;
      if (!isSegmentVisible(source.x, sourceY, target.x, targetY, bounds)) continue;
      drawnEdges += 1;

      const isHighlighted =
        hasHighlight &&
        highlightedElementIds?.has(source.elementId) &&
        highlightedElementIds?.has(target.elementId);
      const isAdjacent =
        activeId !== null && (source.elementId === activeId || target.elementId === activeId);
      const isSelectedEdge = edge.elementId === selectedEdgeId;

      if (isSelectedEdge) {
        context.strokeStyle = styles.primary;
        context.globalAlpha = 1;
        context.lineWidth = 2.6 / viewport.scale;
      } else if (isHighlighted) {
        context.strokeStyle = styles.primary;
        context.globalAlpha = 0.9;
        context.lineWidth = 2 / viewport.scale;
      } else if (isAdjacent) {
        context.strokeStyle = styles.muted;
        context.globalAlpha = 0.8;
        context.lineWidth = 1.4 / viewport.scale;
      } else {
        context.strokeStyle = styles.border;
        context.globalAlpha = hasHighlight || activeId ? 0.18 : 0.55;
        context.lineWidth = 1 / viewport.scale;
      }

      context.beginPath();
      context.moveTo(source.x, sourceY);
      context.lineTo(target.x, targetY);
      context.stroke();

      // Relationship labels, drawn only for edges the user is engaging with —
      // labelling every edge at once is unreadable at any zoom level.
      if (showEdgeLabels && (isAdjacent || isSelectedEdge || isHighlighted)) {
        const midX = (source.x + target.x) / 2;
        const midY = (sourceY + targetY) / 2;
        const text = RELATIONSHIP_LABELS[edge.type] ?? edge.type;

        context.save();
        context.globalAlpha = 1;
        context.font = `500 ${9 / viewport.scale}px Inter, system-ui, sans-serif`;
        context.textAlign = 'center';
        context.textBaseline = 'middle';

        // A pill behind the text so it stays readable over dense edge bundles.
        const padding = 3 / viewport.scale;
        const textWidth = context.measureText(text).width;
        const boxHeight = 12 / viewport.scale;
        context.fillStyle = styles.surface;
        context.globalAlpha = 0.92;
        context.fillRect(
          midX - textWidth / 2 - padding,
          midY - boxHeight / 2,
          textWidth + padding * 2,
          boxHeight,
        );

        context.globalAlpha = 1;
        context.fillStyle = isSelectedEdge ? styles.primary : styles.muted;
        context.fillText(text, midX, midY);
        context.restore();
      }
    }

    // --- nodes ---
    context.globalAlpha = 1;

    for (const node of nodesRef.current) {
      if (node.x === undefined || node.y === undefined) continue;
      if (!isPointVisible(node.x, node.y, bounds)) continue;
      drawnNodes += 1;

      const isSelected = node.elementId === selectedElementId;
      const isHovered = node.elementId === hoveredId;
      const isHighlighted = highlightedElementIds?.has(node.elementId) ?? false;
      const dimmed =
        (hasHighlight && !isHighlighted) ||
        (activeId !== null && !isSelected && !isHovered && !neighbourIds.has(node.elementId));

      context.globalAlpha = dimmed ? 0.25 : 1;
      context.fillStyle = LABEL_STYLES[node.label]?.color ?? styles.muted;

      if (showShapes) {
        traceShape(context, NODE_SHAPES[node.label] ?? 'circle', node.x, node.y, node.radius);
      } else {
        context.beginPath();
        context.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
      }
      context.fill();

      if (isSelected || isHovered || isHighlighted) {
        context.strokeStyle = isHighlighted && !isSelected ? styles.primary : styles.foreground;
        context.lineWidth = 2 / viewport.scale;
        context.stroke();
      }

      if (showNodeLabels && !dimmed) {
        context.globalAlpha = isSelected || isHovered ? 1 : 0.85;
        context.fillStyle = styles.foreground;
        context.font = `${isSelected || isHovered ? 600 : 400} ${11 / viewport.scale}px Inter, system-ui, sans-serif`;
        context.textAlign = 'center';
        context.textBaseline = 'top';
        const label = node.name.length > 26 ? `${node.name.slice(0, 25)}…` : node.name;
        context.fillText(label, node.x, node.y + node.radius + 4 / viewport.scale);
      }
    }

    context.globalAlpha = 1;
    statsRef.current = { drawnNodes, drawnEdges };
  }, [
    version,
    size,
    viewport,
    hoveredId,
    selectedElementId,
    selectedEdgeId,
    highlightedElementIds,
    styles,
    nodesRef,
    edgesRef,
  ]);

  // --- interaction ----------------------------------------------------------

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    const { x, y } = toGraphCoords(event.clientX, event.clientY);
    const node = nodeAt(x, y);

    dragState.current = {
      mode: node ? 'node' : 'pan',
      node,
      startX: event.clientX,
      startY: event.clientY,
      originX: viewport.offsetX,
      originY: viewport.offsetY,
      moved: false,
    };

    if (node) {
      // Pinning the node while dragging is what makes it follow the pointer
      // instead of being pulled back by the simulation on the next tick.
      node.fx = node.x;
      node.fy = node.y;
      reheat(0.32);
    }
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const state = dragState.current;
    const { x, y } = toGraphCoords(event.clientX, event.clientY);

    if (state.mode === 'none') {
      const node = nodeAt(x, y);
      setHoveredId(node?.elementId ?? null);
      return;
    }

    const dx = event.clientX - state.startX;
    const dy = event.clientY - state.startY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) state.moved = true;

    if (state.mode === 'pan') {
      setViewport((current) => ({
        ...current,
        offsetX: state.originX + dx,
        offsetY: state.originY + dy,
      }));
      return;
    }

    if (state.node) {
      state.node.fx = x;
      state.node.fy = y;
      simulation.current?.alpha(0.3).restart();
    }
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const state = dragState.current;

    if (state.mode === 'node' && state.node) {
      // A static layout keeps its pins: releasing them would let the simulation
      // pull the node back out of the arrangement the user chose.
      if (layout === 'force') {
        state.node.fx = null;
        state.node.fy = null;
      } else {
        state.node.fx = state.node.x ?? null;
        state.node.fy = state.node.y ?? null;
      }
      if (!state.moved) {
        onSelect?.(state.node);
        onSelectEdge?.(null);
      }
    } else if (state.mode === 'pan' && !state.moved) {
      // Empty canvas: an edge may still be under the pointer. Nodes were
      // already ruled out on pointer-down, so this cannot steal their click.
      const { x, y } = toGraphCoords(event.clientX, event.clientY);
      const edge = edgeAt(x, y);
      if (edge) {
        emitEdgeSelection(edge);
        onSelect?.(null);
      } else {
        onSelect?.(null);
        onSelectEdge?.(null);
      }
    }

    dragState.current = { ...state, mode: 'none', node: null, moved: false };
    event.currentTarget.releasePointerCapture(event.pointerId);
  };

  /**
   * Keyboard navigation.
   *
   * Arrow keys step to the nearest node in that direction rather than through a
   * flat list: in a spatial layout, "the node to the right" is what a sighted
   * keyboard user means, and list order is arbitrary. With nothing selected,
   * the first arrow press enters at the most connected node.
   */
  const handleKeyDown = (event: React.KeyboardEvent<HTMLCanvasElement>) => {
    const DIRECTIONS: Record<string, [number, number]> = {
      ArrowRight: [1, 0],
      ArrowLeft: [-1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
    };

    if (event.key === 'Escape') {
      onSelect?.(null);
      onSelectEdge?.(null);
      return;
    }

    const current = nodesRef.current.find((node) => node.elementId === selectedElementId);

    if (event.key === 'Enter' || event.key === ' ') {
      if (current) {
        event.preventDefault();
        onExpand?.(current);
      }
      return;
    }

    const direction = DIRECTIONS[event.key];
    if (!direction) return;
    event.preventDefault();

    if (!current) {
      const entry = nodesRef.current.reduce<LayoutNode | null>(
        (best, node) => (best === null || node.degree > best.degree ? node : best),
        null,
      );
      if (entry) onSelect?.(entry);
      return;
    }

    const [dirX, dirY] = direction;
    const originX = current.x ?? 0;
    const originY = current.y ?? 0;

    let best: LayoutNode | null = null;
    let bestCost = Infinity;

    for (const node of nodesRef.current) {
      if (node.elementId === current.elementId || node.x === undefined || node.y === undefined) {
        continue;
      }
      const dx = node.x - originX;
      const dy = node.y - originY;
      const along = dx * dirX + dy * dirY;
      // Behind the direction of travel: not a candidate.
      if (along <= 0) continue;

      // Penalise lateral drift so a node straight ahead beats one off to the
      // side at the same distance.
      const lateral = Math.abs(dx * dirY - dy * dirX);
      const cost = along + lateral * 2;
      if (cost < bestCost) {
        bestCost = cost;
        best = node;
      }
    }

    if (best) {
      onSelect?.(best);
      // Keep the newly selected node on screen when stepping past the edge.
      if (!isPointVisible(best.x ?? 0, best.y ?? 0, visibleBounds(size.width, size.height, viewport.scale, viewport.offsetX, viewport.offsetY, 0))) {
        centreOn(best.x ?? 0, best.y ?? 0);
      }
    }
  };

  const handleDoubleClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const { x, y } = toGraphCoords(event.clientX, event.clientY);
    const node = nodeAt(x, y);
    if (node) onExpand?.(node);
  };

  const handleWheel = (event: React.WheelEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const pointerX = event.clientX - rect.left;
    const pointerY = event.clientY - rect.top;

    setViewport((current) => {
      const nextScale = clamp(current.scale * Math.exp(-event.deltaY * 0.0016), MIN_SCALE, MAX_SCALE);
      const ratio = nextScale / current.scale;
      // Anchor the zoom at the pointer so the graph does not slide under it.
      return {
        scale: nextScale,
        offsetX: pointerX - (pointerX - current.offsetX) * ratio,
        offsetY: pointerY - (pointerY - current.offsetY) * ratio,
      };
    });
  };

  const zoomBy = (factor: number) => {
    setViewport((current) => {
      const nextScale = clamp(current.scale * factor, MIN_SCALE, MAX_SCALE);
      const ratio = nextScale / current.scale;
      const centerX = size.width / 2;
      const centerY = size.height / 2;
      return {
        scale: nextScale,
        offsetX: centerX - (centerX - current.offsetX) * ratio,
        offsetY: centerY - (centerY - current.offsetY) * ratio,
      };
    });
  };

  /** Fits every node into view with a small margin. */
  const fitToView = useCallback(() => {
    const layoutNodes = nodesRef.current.filter(
      (node) => node.x !== undefined && node.y !== undefined,
    );
    if (layoutNodes.length === 0 || size.width === 0) {
      setViewport({ scale: 1, offsetX: 0, offsetY: 0 });
      return;
    }

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const node of layoutNodes) {
      minX = Math.min(minX, (node.x ?? 0) - node.radius);
      minY = Math.min(minY, (node.y ?? 0) - node.radius);
      maxX = Math.max(maxX, (node.x ?? 0) + node.radius);
      maxY = Math.max(maxY, (node.y ?? 0) + node.radius);
    }

    const padding = 48;
    const scale = clamp(
      Math.min(
        (size.width - padding * 2) / Math.max(maxX - minX, 1),
        (size.height - padding * 2) / Math.max(maxY - minY, 1),
      ),
      MIN_SCALE,
      1.6,
    );

    setViewport({
      scale,
      offsetX: size.width / 2 - ((minX + maxX) / 2) * scale,
      offsetY: size.height / 2 - ((minY + maxY) / 2) * scale,
    });
  }, [nodesRef, size]);

  /** Recentres the view on a graph coordinate, used by the minimap. */
  const centreOn = useCallback(
    (graphX: number, graphY: number) => {
      setViewport((current) => ({
        ...current,
        offsetX: size.width / 2 - graphX * current.scale,
        offsetY: size.height / 2 - graphY * current.scale,
      }));
    },
    [size],
  );

  /**
   * Exports the canvas as a PNG.
   *
   * The bitmap is re-rendered onto an opaque backing canvas first: the live
   * canvas has a transparent background, which would produce an image that is
   * unreadable against anything but the app's own dark surface.
   */
  const exportImage = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      notify.error('Nothing to export', { description: 'The canvas has not rendered yet.' });
      return;
    }

    const target = document.createElement('canvas');
    target.width = canvas.width;
    target.height = canvas.height;
    const context = target.getContext('2d');
    if (!context) {
      notify.error('Export failed', {
        description: 'This browser did not provide a 2D drawing context.',
      });
      return;
    }

    context.fillStyle = styles.surface;
    context.fillRect(0, 0, target.width, target.height);
    context.drawImage(canvas, 0, 0);

    const filename = `research-nexus-graph-${new Date().toISOString().slice(0, 10)}.png`;
    const link = document.createElement('a');
    link.download = filename;
    link.href = target.toDataURL('image/png');
    link.click();

    // A download that starts silently is indistinguishable from a dead button;
    // the browser's own indicator is easy to miss on a full-screen canvas.
    notify.success('Graph exported', { description: filename });
  }, [styles.surface]);

  const toggleFullscreen = useCallback(() => {
    const element = containerRef.current;
    if (!element) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void element.requestFullscreen?.();
  }, []);

  // The browser owns fullscreen state - Escape exits without touching our
  // handler - so the button's icon is driven by the event, never assumed.
  useEffect(() => {
    const onChange = () => setIsFullscreen(document.fullscreenElement === containerRef.current);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  return (
    <div
      ref={containerRef}
      style={isFullscreen ? undefined : { height }}
      className={cn(
        'relative overflow-hidden rounded-lg border border-border bg-surface',
        isFullscreen && 'h-screen w-screen rounded-none',
        className,
      )}
    >
      <div className="grid-backdrop pointer-events-none absolute inset-0 opacity-40" aria-hidden />

      <canvas
        ref={canvasRef}
        style={{ width: size.width, height: size.height }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={() => setHoveredId(null)}
        onDoubleClick={handleDoubleClick}
        onWheel={handleWheel}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        className={cn(
          'relative touch-none select-none outline-none focus-visible:ring-2 focus-visible:ring-ring',
          hoveredId ? 'cursor-pointer' : 'cursor-grab active:cursor-grabbing',
        )}
        // `application` rather than `img`: the canvas is interactive, and the
        // role tells a screen reader to pass arrow keys through to it instead
        // of using them for its own virtual cursor.
        role="application"
        aria-label={`Research graph with ${nodes.length} nodes and ${edges.length} relationships. Use arrow keys to move between nodes, Enter to expand, Escape to clear the selection.`}
      />

      <div className="absolute right-3 top-3 flex flex-col gap-1">
        <Button variant="secondary" size="icon-sm" onClick={() => zoomBy(1.25)} aria-label="Zoom in">
          <Plus className="size-3.5" />
        </Button>
        <Button variant="secondary" size="icon-sm" onClick={() => zoomBy(0.8)} aria-label="Zoom out">
          <Minus className="size-3.5" />
        </Button>
        <Button variant="secondary" size="icon-sm" onClick={fitToView} aria-label="Fit to view">
          <Maximize2 className="size-3.5" />
        </Button>
        <Button
          variant="secondary"
          size="icon-sm"
          onClick={() => {
            setViewport({ scale: 1, offsetX: 0, offsetY: 0 });
            reheat(0.8);
          }}
          aria-label="Restart layout"
        >
          <RotateCcw className="size-3.5" />
        </Button>
        <Button
          variant="secondary"
          size="icon-sm"
          onClick={exportImage}
          aria-label="Export graph as PNG"
        >
          <Camera className="size-3.5" />
        </Button>
        <Button
          variant="secondary"
          size="icon-sm"
          onClick={toggleFullscreen}
          aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
        >
          {isFullscreen ? <Minimize2 className="size-3.5" /> : <Scan className="size-3.5" />}
        </Button>
      </div>

      {nodes.length > 0 ? (
        <div className="absolute bottom-3 right-3">
          <GraphMinimap
            nodesRef={nodesRef}
            version={version}
            viewport={viewport}
            size={size}
            onJump={centreOn}
          />
        </div>
      ) : null}

      {isLoading ? (
        <div className="absolute inset-0 grid place-items-center bg-background/60 backdrop-blur-sm">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Traversing the graph…
          </div>
        </div>
      ) : null}

      {!isLoading && nodes.length === 0 ? (
        <div className="absolute inset-0 grid place-items-center">
          <p className="text-xs text-muted-foreground">No nodes to display.</p>
        </div>
      ) : null}

      <p className="pointer-events-none absolute bottom-3 left-3 text-2xs text-muted-foreground">
        Drag to pan · scroll to zoom · click to inspect · double-click to expand
      </p>
    </div>
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
