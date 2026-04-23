import * as vscode from 'vscode';
import { ARCHLENS_DIR, STORAGE_PATHS } from '../../shared/constants';
import type { ArchitectureModel, ArchitectureHypothesis, ComponentLogicResult } from '../../shared/types/architecture';
import type { DiagramModel, ClusterAssignment, FlowWalkthrough } from '../../shared/types/diagrams';
import type { CodeHealthPayload } from '../../shared/types/metrics';
import type { FileInventoryPayload } from '../../shared/types/inventory';
import type {
  UiStateFile,
  FileHashesFile,
  LogicFlowsFile,
  UsageFile,
  SnapshotPointerFile,
} from '../../shared/types/storage';
import type { GitHistoryData } from '../../shared/types/git';

export class ProjectStorageService {
  private static readonly SNAPSHOTS_DIR = 'snapshots';
  private static readonly SNAPSHOTS_LATEST_PATH = 'snapshots/latest.json';

  // Private helpers

  private static getLegacyUri(root: vscode.Uri, relativePath: string): vscode.Uri {
    return vscode.Uri.joinPath(root, ARCHLENS_DIR, relativePath);
  }

  private static getProjectDataRootUri(root: vscode.Uri): vscode.Uri {
    return vscode.Uri.joinPath(root, ARCHLENS_DIR);
  }

  private static getSnapshotsRootUri(root: vscode.Uri): vscode.Uri {
    return vscode.Uri.joinPath(root, ARCHLENS_DIR, this.SNAPSHOTS_DIR);
  }

  private static getSnapshotUri(root: vscode.Uri, snapshotId: string, relativePath: string): vscode.Uri {
    return vscode.Uri.joinPath(root, ARCHLENS_DIR, this.SNAPSHOTS_DIR, snapshotId, relativePath);
  }

  private static getLatestSnapshotPointerUri(root: vscode.Uri): vscode.Uri {
    return vscode.Uri.joinPath(root, ARCHLENS_DIR, this.SNAPSHOTS_LATEST_PATH);
  }

  private static async read<T>(uri: vscode.Uri): Promise<T | undefined> {
    try {
      const raw = await vscode.workspace.fs.readFile(uri);
      return JSON.parse(new TextDecoder().decode(raw)) as T;
    } catch {
      return undefined;
    }
  }

  private static async write<T>(uri: vscode.Uri, value: T): Promise<void> {
    const dir = vscode.Uri.joinPath(uri, '..');
    await vscode.workspace.fs.createDirectory(dir);
    const content = JSON.stringify(value, null, 2);
    await vscode.workspace.fs.writeFile(uri, Buffer.from(content, 'utf-8'));
  }

  private static async deleteFile(uri: vscode.Uri): Promise<void> {
    try {
      await vscode.workspace.fs.delete(uri);
    } catch {
      // File didn't exist - no-op
    }
  }

  static async exists(uri: vscode.Uri): Promise<boolean> {
    try {
      await vscode.workspace.fs.stat(uri);
      return true;
    } catch {
      return false;
    }
  }

  private static async listSnapshotIds(root: vscode.Uri): Promise<string[]> {
    try {
      const entries = await vscode.workspace.fs.readDirectory(this.getSnapshotsRootUri(root));
      return entries
        .filter(([, type]) => type === vscode.FileType.Directory)
        .map(([name]) => name)
        .sort();
    } catch {
      return [];
    }
  }

  static async getLatestSnapshotId(root: vscode.Uri): Promise<string | undefined> {
    const pointer = await this.read<SnapshotPointerFile>(this.getLatestSnapshotPointerUri(root));
    if (pointer?.latestSnapshotId) {
      const snapshotRoot = vscode.Uri.joinPath(this.getSnapshotsRootUri(root), pointer.latestSnapshotId);
      if (await this.exists(snapshotRoot)) {
        return pointer.latestSnapshotId;
      }
    }

    const snapshotIds = await this.listSnapshotIds(root);
    return snapshotIds.at(-1);
  }

  static async beginAnalysisSnapshot(root: vscode.Uri, snapshotId?: string): Promise<string> {
    const nextSnapshotId = snapshotId ?? new Date().toISOString().replace(/[:.]/g, '-');
    await this.write(this.getLatestSnapshotPointerUri(root), {
      latestSnapshotId: nextSnapshotId,
      updatedAt: new Date().toISOString(),
    } satisfies SnapshotPointerFile);
    return nextSnapshotId;
  }

  private static async readScoped<T>(
    root: vscode.Uri,
    relativePath: string,
    snapshotId?: string,
  ): Promise<T | undefined> {
    if (snapshotId) {
      return this.read<T>(this.getSnapshotUri(root, snapshotId, relativePath));
    }

    const latestSnapshotId = await this.getLatestSnapshotId(root);
    if (latestSnapshotId) {
      const value = await this.read<T>(this.getSnapshotUri(root, latestSnapshotId, relativePath));
      if (value !== undefined) {
        return value;
      }
    }

    return this.read<T>(this.getLegacyUri(root, relativePath));
  }

  private static async writeScoped<T>(
    root: vscode.Uri,
    relativePath: string,
    value: T,
    snapshotId?: string,
  ): Promise<void> {
    if (snapshotId) {
      return this.write(this.getSnapshotUri(root, snapshotId, relativePath), value);
    }

    const latestSnapshotId = await this.getLatestSnapshotId(root);
    if (latestSnapshotId) {
      return this.write(this.getSnapshotUri(root, latestSnapshotId, relativePath), value);
    }

    return this.write(this.getLegacyUri(root, relativePath), value);
  }

  private static async deleteScoped(
    root: vscode.Uri,
    relativePath: string,
    snapshotId?: string,
  ): Promise<void> {
    if (snapshotId) {
      return this.deleteFile(this.getSnapshotUri(root, snapshotId, relativePath));
    }

    const latestSnapshotId = await this.getLatestSnapshotId(root);
    if (latestSnapshotId) {
      return this.deleteFile(this.getSnapshotUri(root, latestSnapshotId, relativePath));
    }

    return this.deleteFile(this.getLegacyUri(root, relativePath));
  }

  // Analysis domain

  static async readModel(root: vscode.Uri, snapshotId?: string): Promise<ArchitectureModel | undefined> {
    return this.readScoped<ArchitectureModel>(root, STORAGE_PATHS.model, snapshotId);
  }

  static async writeModel(root: vscode.Uri, value: ArchitectureModel, snapshotId?: string): Promise<void> {
    return this.writeScoped(root, STORAGE_PATHS.model, value, snapshotId);
  }

  static async readHypothesis(root: vscode.Uri, snapshotId?: string): Promise<ArchitectureHypothesis | undefined> {
    return this.readScoped<ArchitectureHypothesis>(root, STORAGE_PATHS.hypothesis, snapshotId);
  }

  static async writeHypothesis(root: vscode.Uri, value: ArchitectureHypothesis, snapshotId?: string): Promise<void> {
    return this.writeScoped(root, STORAGE_PATHS.hypothesis, value, snapshotId);
  }

  static async readDiagram(root: vscode.Uri, snapshotId?: string): Promise<DiagramModel | undefined> {
    return this.readScoped<DiagramModel>(root, STORAGE_PATHS.diagram, snapshotId);
  }

  static async writeDiagram(root: vscode.Uri, value: DiagramModel, snapshotId?: string): Promise<void> {
    return this.writeScoped(root, STORAGE_PATHS.diagram, value, snapshotId);
  }

  static async readInventory(root: vscode.Uri, snapshotId?: string): Promise<FileInventoryPayload | undefined> {
    return this.readScoped<FileInventoryPayload>(root, STORAGE_PATHS.inventory, snapshotId);
  }

  static async writeInventory(root: vscode.Uri, value: FileInventoryPayload, snapshotId?: string): Promise<void> {
    return this.writeScoped(root, STORAGE_PATHS.inventory, value, snapshotId);
  }

  static async deleteProjectData(root: vscode.Uri): Promise<void> {
    try {
      await vscode.workspace.fs.delete(this.getProjectDataRootUri(root), { recursive: true, useTrash: false });
    } catch {
      // Project data didn't exist - no-op
    }
  }

  static async deleteInventory(root: vscode.Uri, snapshotId?: string): Promise<void> {
    return this.deleteScoped(root, STORAGE_PATHS.inventory, snapshotId);
  }

  static async readHashes(root: vscode.Uri, snapshotId?: string): Promise<FileHashesFile | undefined> {
    return this.readScoped<FileHashesFile>(root, STORAGE_PATHS.hashes, snapshotId);
  }

  static async writeHashes(root: vscode.Uri, value: FileHashesFile, snapshotId?: string): Promise<void> {
    return this.writeScoped(root, STORAGE_PATHS.hashes, value, snapshotId);
  }

  // Clusters domain

  static async readClusters(root: vscode.Uri, snapshotId?: string): Promise<ClusterAssignment[] | undefined> {
    return this.readScoped<ClusterAssignment[]>(root, STORAGE_PATHS.clusters, snapshotId);
  }

  static async writeClusters(root: vscode.Uri, value: ClusterAssignment[], snapshotId?: string): Promise<void> {
    return this.writeScoped(root, STORAGE_PATHS.clusters, value, snapshotId);
  }

  static async deleteClusters(root: vscode.Uri, snapshotId?: string): Promise<void> {
    return this.deleteScoped(root, STORAGE_PATHS.clusters, snapshotId);
  }

  // Flows domain

  static async readFlows(root: vscode.Uri, snapshotId?: string): Promise<FlowWalkthrough[] | undefined> {
    return this.readScoped<FlowWalkthrough[]>(root, STORAGE_PATHS.flows, snapshotId);
  }

  static async writeFlows(root: vscode.Uri, value: FlowWalkthrough[], snapshotId?: string): Promise<void> {
    return this.writeScoped(root, STORAGE_PATHS.flows, value, snapshotId);
  }

  static async deleteFlows(root: vscode.Uri, snapshotId?: string): Promise<void> {
    return this.deleteScoped(root, STORAGE_PATHS.flows, snapshotId);
  }

  static async readLogicFlows(root: vscode.Uri, snapshotId?: string): Promise<LogicFlowsFile | undefined> {
    return this.readScoped<LogicFlowsFile>(root, STORAGE_PATHS.logic, snapshotId);
  }

  static async writeLogicFlows(root: vscode.Uri, value: LogicFlowsFile, snapshotId?: string): Promise<void> {
    return this.writeScoped(root, STORAGE_PATHS.logic, value, snapshotId);
  }

  static async deleteLogicFlows(root: vscode.Uri, snapshotId?: string): Promise<void> {
    return this.deleteScoped(root, STORAGE_PATHS.logic, snapshotId);
  }

  // Evidence domain

  static async readEvidence(root: vscode.Uri, snapshotId?: string): Promise<{
    questions: Array<{ question: string; context?: string }>;
    staticEvidence: Array<{ id: number; claim: string; evidence: string; source: string; files?: string[] }>;
    agentFindings: Array<{ id: number; claim: string; evidence: string; source: string; files?: string[] }>;
    agentTrace: Array<{ turn: number; thinking?: string; toolName?: string; toolInput?: unknown; toolResult?: string }>;
  } | undefined> {
    return this.readScoped(root, STORAGE_PATHS.evidence, snapshotId);
  }

  static async writeEvidence(root: vscode.Uri, value: unknown, snapshotId?: string): Promise<void> {
    return this.writeScoped(root, STORAGE_PATHS.evidence, value, snapshotId);
  }

  static async deleteEvidence(root: vscode.Uri, snapshotId?: string): Promise<void> {
    return this.deleteScoped(root, STORAGE_PATHS.evidence, snapshotId);
  }

  // Health domain

  static async readHealth(root: vscode.Uri, snapshotId?: string): Promise<CodeHealthPayload | undefined> {
    return this.readScoped<CodeHealthPayload>(root, STORAGE_PATHS.health, snapshotId);
  }

  static async writeHealth(root: vscode.Uri, value: CodeHealthPayload, snapshotId?: string): Promise<void> {
    return this.writeScoped(root, STORAGE_PATHS.health, value, snapshotId);
  }

  static async deleteHealth(root: vscode.Uri, snapshotId?: string): Promise<void> {
    return this.deleteScoped(root, STORAGE_PATHS.health, snapshotId);
  }

  // Usage domain

  static async readUsage(root: vscode.Uri): Promise<UsageFile | undefined> {
    return this.read<UsageFile>(this.getLegacyUri(root, STORAGE_PATHS.usage));
  }

  static async writeUsage(root: vscode.Uri, value: UsageFile): Promise<void> {
    return this.write(this.getLegacyUri(root, STORAGE_PATHS.usage), value);
  }

  // Git narrative domain

  static async readGitNarrative(root: vscode.Uri, snapshotId?: string): Promise<GitHistoryData['approachable'] | undefined> {
    return this.readScoped<GitHistoryData['approachable']>(root, STORAGE_PATHS.gitNarrative, snapshotId);
  }

  static async writeGitNarrative(root: vscode.Uri, value: GitHistoryData['approachable'], snapshotId?: string): Promise<void> {
    return this.writeScoped(root, STORAGE_PATHS.gitNarrative, value, snapshotId);
  }

  // UI state domain

  static async readUiState(root: vscode.Uri): Promise<UiStateFile | undefined> {
    return this.read<UiStateFile>(this.getLegacyUri(root, STORAGE_PATHS.uiState));
  }

  static async writeUiState(root: vscode.Uri, value: UiStateFile): Promise<void> {
    return this.write(this.getLegacyUri(root, STORAGE_PATHS.uiState), value);
  }

  // Rules domain (used by RuleEngine)

  static getRulesUri(root: vscode.Uri): vscode.Uri {
    return this.getLegacyUri(root, STORAGE_PATHS.rules);
  }

  // Migration from workspaceState

  /**
   * One-time migration from old VS Code workspaceState keys to project files.
   * Safe to call on every activation - exits immediately if already migrated.
   * Clears workspaceState keys after a successful write.
   */
  static async migrateFromWorkspaceState(
    root: vscode.Uri,
    context: vscode.ExtensionContext,
  ): Promise<void> {
    if ((await this.getLatestSnapshotId(root)) || await this.exists(this.getLegacyUri(root, STORAGE_PATHS.model))) {
      return;
    }

    const ws = context.workspaceState;
    const model = ws.get<ArchitectureModel>('archlens.lastModel');
    const hypothesis = ws.get<ArchitectureHypothesis>('archlens.lastHypothesis');
    const diagram = ws.get<DiagramModel>('archlens.lastDiagram');

    if (!model || !hypothesis || !diagram) {
      return;
    }

    console.log('[Atlante] Migrating workspaceState cache to project files...');

    try {
      const snapshotId = await this.beginAnalysisSnapshot(root);

      await Promise.all([
        this.writeModel(root, model, snapshotId),
        this.writeHypothesis(root, hypothesis, snapshotId),
        this.writeDiagram(root, diagram, snapshotId),
      ]);

      const hashEntries = ws.get<[string, string][]>('archlens.fileHashes');
      if (hashEntries) {
        await this.writeHashes(root, hashEntries, snapshotId);
      }

      const explanation = ws.get<string>('archlens.lastExplanation');
      const activeTab = ws.get<string>('archlens.activeTab');
      if (explanation !== undefined || activeTab !== undefined) {
        await this.writeUiState(root, {
          activeTab: activeTab ?? null,
          explanation: explanation ?? null,
        });
      }

      const clusters = ws.get<ClusterAssignment[]>('archlens.clusters.v2');
      if (clusters) {
        await this.writeClusters(root, clusters, snapshotId);
      }

      const flows = ws.get<FlowWalkthrough[]>('archlens.flows');
      if (flows) {
        await this.writeFlows(root, flows, snapshotId);
      }

      const logicFlows = ws.get<[string, ComponentLogicResult][]>('archlens.logicFlows');
      if (logicFlows) {
        await this.writeLogicFlows(root, logicFlows, snapshotId);
      }

      const health = ws.get<CodeHealthPayload>('archlens.codeHealth');
      if (health) {
        await this.writeHealth(root, health, snapshotId);
      }

      const oldRulesUri = vscode.Uri.joinPath(root, ARCHLENS_DIR, 'rules.json');
      const newRulesUri = this.getLegacyUri(root, STORAGE_PATHS.rules);
      if (await this.exists(oldRulesUri) && !(await this.exists(newRulesUri))) {
        const rawRules = await vscode.workspace.fs.readFile(oldRulesUri);
        await vscode.workspace.fs.createDirectory(vscode.Uri.joinPath(newRulesUri, '..'));
        await vscode.workspace.fs.writeFile(newRulesUri, rawRules);
        await vscode.workspace.fs.delete(oldRulesUri);
        console.log('[Atlante] Migrated rules.json to rules/rules.json');
      }

      await Promise.all([
        ws.update('archlens.lastModel', undefined),
        ws.update('archlens.lastHypothesis', undefined),
        ws.update('archlens.lastDiagram', undefined),
        ws.update('archlens.fileHashes', undefined),
        ws.update('archlens.lastExplanation', undefined),
        ws.update('archlens.activeTab', undefined),
        ws.update('archlens.clusters.v2', undefined),
        ws.update('archlens.flows', undefined),
        ws.update('archlens.logicFlows', undefined),
        ws.update('archlens.codeHealth', undefined),
      ]);

      console.log('[Atlante] Migration complete. workspaceState cleared.');
    } catch (err) {
      console.error('[Atlante] Migration failed - workspaceState preserved for retry:', err);
    }
  }
}
