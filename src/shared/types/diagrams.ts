/**
 * Diagram model types.
 *
 * These are the VISUAL representation types — they bridge the gap between
 * the semantic ArchitectureModel and the D3.js rendering.
 *
 * The layout engine transforms ArchitectureModel → DiagramModel (adding x,y positions).
 * The webview renders DiagramModel → SVG.
 */

import type { ComponentType, RelationType, ArchitectureMetadata } from './architecture';

// ─── Diagram Model (what the webview receives) ─────────────────────

export interface DiagramModel {
  components: DiagramNode[];
  relations: DiagramEdge[];
  metadata: ArchitectureMetadata | null;
  /** Per-layer ordering from hypothesis (layer name → sort order). Used for per-stack layout. */
  layerOrder?: Record<string, number>;
}

// ─── Nodes ──────────────────────────────────────────────────────────

export type DiffStatus = 'unchanged' | 'added' | 'removed' | 'modified';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

export interface DiagramNode {
  id: string;
  label: string;
  type: ComponentType;
  layer?: string;
  /** Deployment stack this node belongs to (e.g., "backend", "frontend") */
  stack?: string;

  /** Layout position (set by layout engine) */
  x: number;
  y: number;
  width: number;
  height: number;

  /** Ghost Diff state */
  diffStatus: DiffStatus;
  approvalStatus: ApprovalStatus;

  /** Tooltip content */
  responsibilities: string[];
  files: string[];

  /** Change details (when diffStatus is 'modified') */
  changeDescription?: string;
}

// ─── Group Nodes (aggregated components for graph simplification) ────

export interface GroupNode {
  kind: 'group';
  /** Stable ID: "group::<layer>" or "group::<stack>::<layer>" */
  id: string;
  layerName: string;
  stack?: string;
  nodeCount: number;
  /** Component type breakdown, e.g. { service: 5, other: 3 } */
  typeBreakdown: Record<string, number>;
  /** IDs of DiagramNodes absorbed into this group */
  childNodeIds: string[];
  /** Cluster name when this group was created from cluster data */
  clusterName?: string;

  /** Layout position (set by layout engine) */
  x: number;
  y: number;
  width: number;
  height: number;
}

// ─── Edges ──────────────────────────────────────────────────────────

export interface DiagramEdge {
  id: string;
  sourceId: string;
  targetId: string;
  type: RelationType;
  label?: string;

  /** Path points for rendering (set by layout engine) */
  points: Array<{ x: number; y: number }>;

  /** Ghost Diff state */
  diffStatus: DiffStatus;
}

// ─── Stack Summary (Level 1 drill-down view) ──────────────────────────

/** A single stack node for the overview graph (e.g., "Backend", "Frontend"). */
export interface StackSummaryNode {
  id: string;
  name: string;
  componentCount: number;
  layerNames: string[];
  stack: string;
}

/** An aggregated edge between two stacks in the overview graph. */
export interface StackSummaryEdge {
  id: string;
  sourceStackId: string;
  targetStackId: string;
  /** Aggregated labels from cross-stack edges, e.g., ["REST API", "WebSocket"] */
  labels: string[];
  edgeCount: number;
}

// Cluster groups

/**
 * One feature cluster retained for legacy diagram snapshots.
 * nodeIds reference DiagramNode.id values in the current diagram.
 */
export interface ClusterAssignment {
  /** Stable identifier, e.g. "cluster-auth" */
  id: string;
  /** 2–4 word human-readable domain name, e.g. "Auth & API" */
  name: string;
  /** One-sentence description of what this cluster does */
  description: string;
  /** 2–3 sentence educational paragraph for someone new to the repo */
  lore: string;
  /** DiagramNode.id values that belong to this cluster */
  nodeIds: string[];
  /** Stack this cluster belongs to (set for multi-stack projects) */
  stack?: string;
}

// Flow walkthroughs

/** A single step in a guided flow walkthrough. */
export interface FlowStep {
  /** 0-based index within the flow */
  index: number;
  /** Component ID for this step (must match DiagramNode.id) */
  componentId: string;
  /** 1–2 sentence narrative of what happens at this step (filled by detail call) */
  narrative?: string;
}

/**
 * One end-to-end flow through the architecture retained for legacy snapshots.
 * Steps are ordered chronologically (request flow, not dependency direction).
 */
export interface FlowWalkthrough {
  /** Stable kebab-case ID, e.g. "user-login-flow" */
  id: string;
  /** 2–5 word human-readable title, e.g. "User Login Flow" */
  name: string;
  /** One-sentence description of what this flow does */
  description: string;
  /** Ordered list of steps through components */
  steps: FlowStep[];
}

// ─── Sequence Diagram Types ─────────────────────────────────────────

export interface SequenceDiagramModel {
  participants: SequenceParticipant[];
  messages: SequenceMessage[];
}

export interface SequenceParticipant {
  id: string;
  label: string;
  type: ComponentType;
  /** Horizontal order (0 = leftmost) */
  order: number;
}

export interface SequenceMessage {
  id: string;
  fromId: string;
  toId: string;
  label: string;
  /** Vertical order (0 = topmost, represents time) */
  order: number;
  type: 'sync' | 'async' | 'return';
}
