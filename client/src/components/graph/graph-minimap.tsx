import { useEffect, useRef } from 'react';

import { LABEL_STYLES } from '@/lib/utils';

import type { LayoutNode } from './use-force-layout';

interface GraphMinimapProps {
  nodesRef: React.MutableRefObject<LayoutNode[]>;
  /** Bumped by the simulation on every tick; drives the repaint. */
  version: number;
  viewport: { scale: number; offsetX: number; offsetY: number };
  size: { width: number; height: number };
  onJump: (graphX: number, graphY: number) => void;
}

const MINIMAP_WIDTH = 148;
const MINIMAP_HEIGHT = 104;
const PADDING = 6;

/**
 * Overview map with a viewport rectangle.
 *
 * Once a graph is larger than the screen, pan and zoom alone give no sense of
 * where you are in it. The minimap restores that: it draws every node at
 * one-pixel scale — cheap enough to repaint per tick — and outlines the region
 * currently on screen. Clicking recentres the main canvas there.
 *
 * Nodes are drawn as plain dots rather than shapes; at this size the shape
 * vocabulary is invisible, and colour alone still communicates composition.
 */
export function GraphMinimap({
  nodesRef,
  version,
  viewport,
  size,
  onJump,
}: GraphMinimapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  /** Graph→minimap transform, reused by the click handler to invert it. */
  const transformRef = useRef({ scale: 1, offsetX: 0, offsetY: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = MINIMAP_WIDTH * dpr;
    canvas.height = MINIMAP_HEIGHT * dpr;
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, MINIMAP_WIDTH, MINIMAP_HEIGHT);

    const nodes = nodesRef.current.filter(
      (node) => node.x !== undefined && node.y !== undefined,
    );
    if (nodes.length === 0) return;

    // Fit the graph's bounding box into the minimap.
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const node of nodes) {
      minX = Math.min(minX, node.x ?? 0);
      minY = Math.min(minY, node.y ?? 0);
      maxX = Math.max(maxX, node.x ?? 0);
      maxY = Math.max(maxY, node.y ?? 0);
    }

    const graphWidth = Math.max(maxX - minX, 1);
    const graphHeight = Math.max(maxY - minY, 1);
    const scale = Math.min(
      (MINIMAP_WIDTH - PADDING * 2) / graphWidth,
      (MINIMAP_HEIGHT - PADDING * 2) / graphHeight,
    );
    const offsetX = PADDING - minX * scale + (MINIMAP_WIDTH - PADDING * 2 - graphWidth * scale) / 2;
    const offsetY = PADDING - minY * scale + (MINIMAP_HEIGHT - PADDING * 2 - graphHeight * scale) / 2;

    transformRef.current = { scale, offsetX, offsetY };

    for (const node of nodes) {
      context.fillStyle = LABEL_STYLES[node.label]?.color ?? '#8891a5';
      context.globalAlpha = 0.85;
      context.beginPath();
      context.arc((node.x ?? 0) * scale + offsetX, (node.y ?? 0) * scale + offsetY, 1.4, 0, Math.PI * 2);
      context.fill();
    }

    // The viewport rectangle: the visible region converted into minimap space.
    const viewMinX = (-viewport.offsetX / viewport.scale) * scale + offsetX;
    const viewMinY = (-viewport.offsetY / viewport.scale) * scale + offsetY;
    const viewWidth = (size.width / viewport.scale) * scale;
    const viewHeight = (size.height / viewport.scale) * scale;

    context.globalAlpha = 1;
    context.strokeStyle = 'rgba(255,255,255,0.85)';
    context.lineWidth = 1;
    context.strokeRect(viewMinX, viewMinY, viewWidth, viewHeight);
    context.fillStyle = 'rgba(255,255,255,0.08)';
    context.fillRect(viewMinX, viewMinY, viewWidth, viewHeight);
  }, [version, viewport, size, nodesRef]);

  return (
    <canvas
      ref={canvasRef}
      width={MINIMAP_WIDTH}
      height={MINIMAP_HEIGHT}
      style={{ width: MINIMAP_WIDTH, height: MINIMAP_HEIGHT }}
      onClick={(event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        const { scale, offsetX, offsetY } = transformRef.current;
        // Invert the minimap transform to get graph coordinates.
        onJump(
          (event.clientX - rect.left - offsetX) / scale,
          (event.clientY - rect.top - offsetY) / scale,
        );
      }}
      className="cursor-pointer rounded-md border border-border bg-background/80 backdrop-blur-sm"
      aria-label="Graph overview. Click to recentre the view."
    />
  );
}
