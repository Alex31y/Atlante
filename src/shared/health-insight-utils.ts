/**
 * Health Insight Agent Utilities
 *
 * Pure functions for selecting insights to brief the agent and merging agent verdicts.
 * Shared between extension host (orchestrator) and worker (agent).
 * No vscode or worker-specific imports.
 */

import type { ArchInsight, AgentInsightAction, InsightKind } from './types/metrics';

// ─── Types ──────────────────────────────────────────────────────────

export interface BriefedInsight {
  index: number;
  kind: string;
  title: string;
  file: string;
  summaryLine?: string;
  shortDescription: string;
}

export interface DiscoveryTarget {
  filePath: string;
  kpiScore: number;
  priorityScore?: number;
  loc: number;
  maxCognitiveComplexity: number;
  fanOut: number;
}

export interface FileMetricsSlice {
  filePath: string;
  kpiScore: number;
  priorityScore?: number;
  loc: number;
  maxCognitiveComplexity: number;
  fanOut: number;
}

// ─── Configuration ──────────────────────────────────────────────────

const MAX_BRIEFED_INSIGHTS = 30;
const MAX_DISCOVERY_TARGETS = 10;

/** Kinds most prone to false positives (prioritize for verification). */
const HIGH_FP_KINDS = new Set<InsightKind>([
  'brain-method', 'high-param-count', 'god-file', 'copy-paste-smell', 'hub-file',
]);

// ─── Insight Selection ──────────────────────────────────────────────

export function selectInsightsForAgent(
  insights: ArchInsight[],
  files: FileMetricsSlice[],
): { briefedInsights: BriefedInsight[]; briefedIndices: number[]; discoveryTargets: DiscoveryTarget[] } {
  // Rank insights: critical first, then high-FP-risk kinds, then warning, then info
  const ranked = insights.map((ins, i) => ({ ins, originalIndex: i }));
  ranked.sort((a, b) => {
    const sevOrder: Record<string, number> = { critical: 0, warning: 1, info: 2 };
    const sa = sevOrder[a.ins.severity] ?? 3;
    const sb = sevOrder[b.ins.severity] ?? 3;
    if (sa !== sb) return sa - sb;
    const fa = HIGH_FP_KINDS.has(a.ins.kind) ? 0 : 1;
    const fb = HIGH_FP_KINDS.has(b.ins.kind) ? 0 : 1;
    return fa - fb;
  });

  const selected = ranked.slice(0, MAX_BRIEFED_INSIGHTS);
  const briefedIndices = selected.map((s) => s.originalIndex);
  const briefedInsights: BriefedInsight[] = selected.map((s) => ({
    index: s.originalIndex,
    kind: s.ins.kind,
    title: s.ins.title,
    file: s.ins.files[0] ?? '',
    summaryLine: s.ins.summaryLine,
    shortDescription: s.ins.shortDescription,
  }));

  // Discovery targets: highest-priority files not already covered by briefed insights
  const coveredFiles = new Set(briefedInsights.map((b) => b.file));
  const discoveryTargets: DiscoveryTarget[] = files
    .filter((f) => !coveredFiles.has(f.filePath))
    .sort((a, b) => (b.priorityScore ?? (100 - b.kpiScore)) - (a.priorityScore ?? (100 - a.kpiScore)))
    .slice(0, MAX_DISCOVERY_TARGETS)
    .map((f) => ({
      filePath: f.filePath,
      kpiScore: f.kpiScore,
      priorityScore: f.priorityScore,
      loc: f.loc,
      maxCognitiveComplexity: f.maxCognitiveComplexity,
      fanOut: f.fanOut,
    }));

  return { briefedInsights, briefedIndices, discoveryTargets };
}

// ─── Merge Logic ────────────────────────────────────────────────────

const VALID_INSIGHT_KINDS = new Set<string>([
  'circular-dep', 'hub-file', 'tangled-pair', 'unstable-dep', 'export-waste',
  'brain-method', 'god-file', 'deep-nesting', 'complex-conditional', 'high-param-count',
  'copy-paste-smell', 'dependency-sprawl', 'high-surface-area',
  'hotspot', 'bus-factor-risk', 'stale-code', 'git-healthy', 'logical-coupling',
  'agent-discovered',
]);

/**
 * Apply agent verdicts to the original insight list.
 * - false-positive: removed
 * - enriched: shortDescription/learnDescription replaced, agentVerified = true
 * - confirmed: agentVerified = true
 * - new: appended with agentVerified = true
 * Unbriefed insights are kept unchanged.
 */
export function mergeAgentVerdicts(
  originalInsights: ArchInsight[],
  _briefedIndices: number[],
  actions: AgentInsightAction[],
): ArchInsight[] {
  const actionMap = new Map<number, AgentInsightAction>();
  const newInsights: ArchInsight[] = [];

  for (const action of actions) {
    if (action.verdict === 'new' && action.newInsight) {
      newInsights.push({ ...action.newInsight, agentVerified: true });
    } else if (action.insightIndex !== undefined) {
      actionMap.set(action.insightIndex, action);
    }
  }

  const result: ArchInsight[] = [];
  for (let i = 0; i < originalInsights.length; i++) {
    const action = actionMap.get(i);
    if (!action) {
      result.push(originalInsights[i]);
      continue;
    }

    if (action.verdict === 'false-positive') {
      console.log(`[Health Insights] Removed FP: ${originalInsights[i].kind} in ${originalInsights[i].files[0]}`);
      continue;
    }

    if (action.verdict === 'enriched') {
      result.push({
        ...originalInsights[i],
        shortDescription: action.enrichedShortDescription ?? originalInsights[i].shortDescription,
        learnDescription: action.enrichedLearnDescription ?? originalInsights[i].learnDescription,
        agentVerified: true,
      });
      continue;
    }

    if (action.verdict === 'confirmed') {
      result.push({ ...originalInsights[i], agentVerified: true });
      continue;
    }

    result.push(originalInsights[i]);
  }

  for (const ins of newInsights) {
    // Validate kind
    if (!VALID_INSIGHT_KINDS.has(ins.kind)) {
      ins.kind = 'agent-discovered' as InsightKind;
    }
    result.push(ins);
  }

  const sevOrder: Record<string, number> = { critical: 0, warning: 1, info: 2 };
  result.sort((a, b) => (sevOrder[a.severity] ?? 3) - (sevOrder[b.severity] ?? 3));

  return result;
}
