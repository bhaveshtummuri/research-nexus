import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
  type Simulation,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
} from 'd3-force';
import { useEffect, useRef, useState } from 'react';

import type { GraphEdgeView, GraphNodeView } from '@/types/api';

import { applyLayout, type GraphLayout } from './layouts';

export interface LayoutNode extends SimulationNodeDatum, GraphNodeView {
  /** Rendered radius, derived from the node's degree in the whole graph. */
  radius: number;
}

export interface LayoutEdge extends SimulationLinkDatum<LayoutNode> {
  elementId: string;
  type: string;
  source: LayoutNode | string;
  target: LayoutNode | string;
}

interface LayoutOptions {
  width: number;
  height: number;
  nodes: GraphNodeView[];
  edges: GraphEdgeView[];
  /** Static layouts pin positions; `force` lets the simulation place nodes. */
  layout?: GraphLayout;
  /** Root for the rooted layouts. Defaults to the most connected node. */
  rootElementId?: string | null;
}

/** Hubs are drawn larger, but the growth is sublinear so they cannot dominate. */
function radiusForDegree(degree: number): number {
  return Math.min(5 + Math.sqrt(degree) * 1.8, 20);
}

/**
 * Runs a d3-force simulation and exposes its positions to React.
 *
 * The simulation mutates node objects in place at ~60fps; putting those objects
 * in React state would re-render the tree on every tick. Instead the nodes are
 * held in a ref, the canvas reads them directly, and a monotonically increasing
 * `version` counter is the only piece of state that changes - just enough to
 * trigger a repaint.
 */
export function useForceLayout({
  width,
  height,
  nodes,
  edges,
  layout = 'force',
  rootElementId = null,
}: LayoutOptions) {
  const nodesRef = useRef<LayoutNode[]>([]);
  const edgesRef = useRef<LayoutEdge[]>([]);
  const simulationRef = useRef<Simulation<LayoutNode, LayoutEdge> | null>(null);
  const [version, setVersion] = useState(0);
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    if (width === 0 || height === 0 || nodes.length === 0) {
      nodesRef.current = [];
      edgesRef.current = [];
      setVersion((value) => value + 1);
      return;
    }

    // Positions are carried over between refreshes so expanding a neighbourhood
    // animates outward from where the existing nodes already sit rather than
    // re-scattering the whole view.
    const previous = new Map(nodesRef.current.map((node) => [node.elementId, node]));

    const layoutNodes: LayoutNode[] = nodes.map((node, index) => {
      const existing = previous.get(node.elementId);
      const angle = (index / nodes.length) * Math.PI * 2;
      return {
        ...node,
        radius: radiusForDegree(node.degree),
        x: existing?.x ?? width / 2 + Math.cos(angle) * Math.min(width, height) * 0.3,
        y: existing?.y ?? height / 2 + Math.sin(angle) * Math.min(width, height) * 0.3,
        vx: existing?.vx ?? 0,
        vy: existing?.vy ?? 0,
      };
    });

    const byElementId = new Map(layoutNodes.map((node) => [node.elementId, node]));
    const layoutEdges: LayoutEdge[] = edges
      .filter((edge) => byElementId.has(edge.source) && byElementId.has(edge.target))
      .map((edge) => ({
        elementId: edge.elementId,
        type: edge.type,
        source: byElementId.get(edge.source) as LayoutNode,
        target: byElementId.get(edge.target) as LayoutNode,
      }));

    nodesRef.current = layoutNodes;
    edgesRef.current = layoutEdges;
    setSettled(false);

    // A static layout writes final positions before the simulation starts, so
    // the first painted frame is already correct rather than animating in from
    // a force arrangement the user did not ask for.
    applyLayout(layout, layoutNodes, edges, { width, height }, rootElementId);

    const simulation = forceSimulation<LayoutNode, LayoutEdge>(layoutNodes)
      .force(
        'link',
        forceLink<LayoutNode, LayoutEdge>(layoutEdges)
          .id((node) => node.elementId)
          // Denser graphs need longer links to stay legible.
          .distance(() => 46 + Math.min(layoutNodes.length, 200) * 0.18)
          .strength(0.25),
      )
      // Repulsion is capped by distance so distant clusters do not fly apart.
      .force('charge', forceManyBody<LayoutNode>().strength(-190).distanceMax(420))
      .force('center', forceCenter(width / 2, height / 2))
      .force(
        'collide',
        forceCollide<LayoutNode>().radius((node) => node.radius + 8).strength(0.85),
      )
      // Weak positional forces keep disconnected components on screen.
      .force('x', forceX(width / 2).strength(0.035))
      .force('y', forceY(height / 2).strength(0.035))
      // A static layout is already in its final position, so the simulation is
      // started cold: it exists only to service dragging, and any alpha above
      // zero would visibly unsettle the arrangement that was just computed.
      .alpha(layout === 'force' ? 0.9 : 0)
      .alphaDecay(0.028);

    simulation.on('tick', () => setVersion((value) => value + 1));
    simulation.on('end', () => setSettled(true));
    simulationRef.current = simulation;

    if (layout !== 'force') {
      simulation.stop();
      setSettled(true);
      setVersion((value) => value + 1);
    }

    return () => {
      simulation.stop();
      simulationRef.current = null;
    };
  }, [width, height, nodes, edges, layout, rootElementId]);

  /** Re-heats the simulation, used when a node is dragged or the view resets. */
  const reheat = (alpha = 0.5) => {
    simulationRef.current?.alpha(alpha).restart();
    setSettled(false);
  };

  return { nodesRef, edgesRef, version, settled, reheat, simulation: simulationRef };
}
