/**
 * Ghost Diff types.
 *
 * Represents the structural difference between two ArchitectureModel snapshots.
 * This is a GRAPH diff — it operates on components and relations, not on text lines.
 *
 * The Diff Worker produces GhostDiffModel.
 * The webview consumes it to render the Visual Ghost Diff overlay.
 */

import type { ArchComponent, ArchRelation, ArchitectureModel } from './architecture';

// ─── Ghost Diff Model ───────────────────────────────────────────────

export interface GhostDiffModel {
  /** The "before" state (base architecture) */
  baseSnapshot: ArchitectureModel;
  /** The "after" state (with agent's changes applied) */
  currentSnapshot: ArchitectureModel;

  /** Components that exist only in currentSnapshot */
  addedComponents: ArchComponent[];
  /** Components that exist only in baseSnapshot */
  removedComponents: ArchComponent[];
  /** Components that exist in both but have changed */
  modifiedComponents: ComponentDiff[];
  /** Component IDs that are unchanged */
  unchangedComponentIds: string[];

  /** Relations that exist only in currentSnapshot */
  addedRelations: ArchRelation[];
  /** Relations that exist only in baseSnapshot */
  removedRelations: ArchRelation[];
  /** Relations that changed (e.g., type changed, label changed) */
  modifiedRelations: RelationDiff[];

  /** Summary of changes in natural language */
  changeSummary: string;
}

// ─── Component Diff ─────────────────────────────────────────────────

export interface ComponentDiff {
  componentId: string;
  before: ArchComponent;
  after: ArchComponent;
  changes: ComponentChanges;
}

export interface ComponentChanges {
  nameChanged: boolean;
  typeChanged: boolean;
  layerChanged: boolean;
  filesAdded: string[];
  filesRemoved: string[];
  responsibilitiesChanged: boolean;
  /** New responsibilities in the "after" state */
  newResponsibilities: string[];
  /** Removed responsibilities from the "before" state */
  removedResponsibilities: string[];
}

// ─── Relation Diff ──────────────────────────────────────────────────

export interface RelationDiff {
  relationId: string;
  before: ArchRelation;
  after: ArchRelation;
  changes: {
    typeChanged: boolean;
    labelChanged: boolean;
  };
}
