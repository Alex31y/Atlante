import * as vscode from 'vscode';
import type { ProjectEntry, ProjectSummary } from '../../shared/types/projects';
import { ARCHLENS_DIR } from '../../shared/constants';

const STORAGE_KEY = 'codeChecker.projects';

/**
 * Persistent registry of analyzed projects.
 * Backed by VS Code globalState so it survives across sessions and workspaces.
 */
export class ProjectRegistryService {
  constructor(private readonly context: vscode.ExtensionContext) {}

  /** Get all registered projects. */
  getAll(): ProjectEntry[] {
    return this.context.globalState.get<ProjectEntry[]>(STORAGE_KEY) ?? [];
  }

  /** Add or update a project entry. */
  async upsert(entry: ProjectEntry): Promise<void> {
    const list = this.getAll();
    const idx = list.findIndex((p) => p.fsPath === entry.fsPath);
    if (idx >= 0) {
      list[idx] = entry;
    } else {
      list.push(entry);
    }
    await this.context.globalState.update(STORAGE_KEY, list);
  }

  /** Update only the summary for an existing project. */
  async updateSummary(fsPath: string, summary: ProjectSummary): Promise<void> {
    const list = this.getAll();
    const entry = list.find((p) => p.fsPath === fsPath);
    if (entry) {
      entry.summary = summary;
      await this.context.globalState.update(STORAGE_KEY, list);
    }
  }

  /** Remove a project from the registry. */
  async remove(fsPath: string): Promise<void> {
    const list = this.getAll().filter((p) => p.fsPath !== fsPath);
    await this.context.globalState.update(STORAGE_KEY, list);
  }

  /** Prune entries whose project data folder no longer exists on disk. */
  async validate(): Promise<void> {
    const list = this.getAll();
    const valid: ProjectEntry[] = [];
    for (const entry of list) {
      try {
        const dataUri = vscode.Uri.joinPath(vscode.Uri.file(entry.fsPath), ARCHLENS_DIR);
        await vscode.workspace.fs.stat(dataUri);
        valid.push(entry);
      } catch {
        // Project data folder does not exist, skip this entry.
      }
    }
    if (valid.length !== list.length) {
      await this.context.globalState.update(STORAGE_KEY, valid);
    }
  }
}
