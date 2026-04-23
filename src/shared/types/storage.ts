/**
 * Types for data persisted to project files.
 */

import type { ComponentLogicResult } from './architecture';

/** Shape of ui/state.json */
export interface UiStateFile {
  activeTab: string | null;
  explanation: string | null;
}

/** Shape of analysis/hashes.json — serialized Map<path, sha256> */
export type FileHashesFile = [string, string][];

/** Shape of flows/logic.json — serialized Map<componentId, ComponentLogicResult> */
export type LogicFlowsFile = [string, ComponentLogicResult][];

/** Shape of usage/usage.json — lifetime totals + recent session entries */
export interface UsageFile {
  lifetimeSessionCount: number;
  recentEntries: Array<Record<string, unknown>>;
}

/** Shape of snapshots/latest.json */
export interface SnapshotPointerFile {
  latestSnapshotId: string;
  updatedAt: string;
}

