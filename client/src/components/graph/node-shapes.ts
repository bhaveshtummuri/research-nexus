import type { NodeLabel } from '@/types/api';

export type NodeShape = 'circle' | 'square' | 'diamond' | 'triangle' | 'hexagon' | 'pentagon';

/**
 * Shape per entity type, carried alongside colour rather than instead of it.
 *
 * Colour alone is not a sufficient encoding: roughly one in twelve men has a
 * colour-vision deficiency, and ten hues at 12px are hard for anyone to tell
 * apart. Shape is redundant encoding — it survives greyscale printing, low
 * zoom, and the moment two palette entries look alike on a dim laptop screen.
 *
 * Shapes are grouped by kind so the mapping is learnable: people and
 * organisations are rounded, documents are angular, abstractions are pointed.
 */
export const NODE_SHAPES: Record<NodeLabel, NodeShape> = {
  Author: 'circle',
  University: 'hexagon',
  FundingAgency: 'pentagon',

  Paper: 'square',
  Journal: 'square',
  Conference: 'square',

  ResearchTopic: 'diamond',
  Keyword: 'triangle',

  Dataset: 'hexagon',
  Project: 'pentagon',
};

/**
 * Traces a shape's outline into the current path, centred on (x, y).
 *
 * `radius` is the circumradius for every shape, so a square and a circle of the
 * same radius read as the same visual weight rather than the square dominating.
 */
export function traceShape(
  context: CanvasRenderingContext2D,
  shape: NodeShape,
  x: number,
  y: number,
  radius: number,
): void {
  context.beginPath();

  switch (shape) {
    case 'circle':
      context.arc(x, y, radius, 0, Math.PI * 2);
      break;

    case 'square': {
      // Inscribed square, so its area is comparable to the circle's.
      const half = radius * 0.82;
      context.rect(x - half, y - half, half * 2, half * 2);
      break;
    }

    case 'diamond':
      context.moveTo(x, y - radius);
      context.lineTo(x + radius, y);
      context.lineTo(x, y + radius);
      context.lineTo(x - radius, y);
      context.closePath();
      break;

    case 'triangle': {
      // Nudged down so the centroid, not the bounding box, sits on (x, y).
      const offset = radius * 0.18;
      context.moveTo(x, y - radius + offset);
      context.lineTo(x + radius * 0.92, y + radius * 0.6 + offset);
      context.lineTo(x - radius * 0.92, y + radius * 0.6 + offset);
      context.closePath();
      break;
    }

    case 'pentagon':
      tracePolygon(context, x, y, radius, 5);
      break;

    case 'hexagon':
      tracePolygon(context, x, y, radius, 6);
      break;
  }
}

function tracePolygon(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  sides: number,
): void {
  for (let index = 0; index < sides; index += 1) {
    // Start at -90° so polygons sit point-up rather than rotated arbitrarily.
    const angle = (index / sides) * Math.PI * 2 - Math.PI / 2;
    const pointX = x + Math.cos(angle) * radius;
    const pointY = y + Math.sin(angle) * radius;
    if (index === 0) context.moveTo(pointX, pointY);
    else context.lineTo(pointX, pointY);
  }
  context.closePath();
}

/**
 * Squared distance from a point to a line segment.
 *
 * Used for edge hit-testing. Squared rather than actual distance because the
 * caller only ever compares it against a threshold, and this runs once per edge
 * per pointer move — skipping the square root is measurable at a few thousand
 * edges.
 */
export function distanceToSegmentSquared(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lengthSquared = dx * dx + dy * dy;

  if (lengthSquared === 0) {
    // Degenerate segment: both endpoints coincide.
    return (px - x1) ** 2 + (py - y1) ** 2;
  }

  // Projection of the point onto the segment, clamped to its extent.
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lengthSquared));
  const projectedX = x1 + t * dx;
  const projectedY = y1 + t * dy;

  return (px - projectedX) ** 2 + (py - projectedY) ** 2;
}

export interface ViewportBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/**
 * The visible region in graph coordinates, with a margin.
 *
 * The margin keeps nodes that are partly on screen — and the labels hanging
 * below them — from popping in at the edge as the user pans.
 */
export function visibleBounds(
  width: number,
  height: number,
  scale: number,
  offsetX: number,
  offsetY: number,
  margin = 80,
): ViewportBounds {
  return {
    minX: (-offsetX - margin) / scale,
    minY: (-offsetY - margin) / scale,
    maxX: (width - offsetX + margin) / scale,
    maxY: (height - offsetY + margin) / scale,
  };
}

export function isPointVisible(x: number, y: number, bounds: ViewportBounds): boolean {
  return x >= bounds.minX && x <= bounds.maxX && y >= bounds.minY && y <= bounds.maxY;
}

/**
 * Whether a segment could intersect the viewport.
 *
 * A cheap bounding-box rejection rather than an exact test: an edge whose box
 * misses the viewport certainly misses it, and the occasional false positive
 * costs one `stroke` that clips to nothing.
 */
export function isSegmentVisible(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  bounds: ViewportBounds,
): boolean {
  if (Math.max(x1, x2) < bounds.minX) return false;
  if (Math.min(x1, x2) > bounds.maxX) return false;
  if (Math.max(y1, y2) < bounds.minY) return false;
  if (Math.min(y1, y2) > bounds.maxY) return false;
  return true;
}
