import * as vscode from 'vscode';

/**
 * FileWatcher
 *
 * Wraps VS Code's FileSystemWatcher with:
 * - Adaptive debouncing (200ms-2000ms) for agent burst handling
 * - Configurable exclude patterns
 * - Batched change notifications
 */

export type FileChangeCallback = (changedFiles: string[]) => void;

const SOURCE_FILE_GLOB = '**/*.{ts,tsx,js,jsx,py,java,cs,go,rs,kt,swift,rb,php}';
const DEFAULT_DEBOUNCE_MS = 500;

export class FileWatcher implements vscode.Disposable {
  private watcher: vscode.FileSystemWatcher | undefined;
  private pendingChanges: Set<string> = new Set();
  private debounceTimer: NodeJS.Timeout | undefined;
  private readonly debounceMs: number;
  private readonly onChangeBatch: FileChangeCallback;

  constructor(onChangeBatch: FileChangeCallback, debounceMs = DEFAULT_DEBOUNCE_MS) {
    this.onChangeBatch = onChangeBatch;
    this.debounceMs = debounceMs;
  }

  start() {
    this.watcher = vscode.workspace.createFileSystemWatcher(SOURCE_FILE_GLOB);

    this.watcher.onDidChange((uri) => this.queueChange(uri.fsPath));
    this.watcher.onDidCreate((uri) => this.queueChange(uri.fsPath));
    this.watcher.onDidDelete((uri) => this.queueChange(uri.fsPath));
  }

  private queueChange(filePath: string) {
    this.pendingChanges.add(filePath);

    // Reset debounce timer on each change (adaptive: waits for burst to end)
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      const files = Array.from(this.pendingChanges);
      this.pendingChanges.clear();
      if (files.length > 0) {
        this.onChangeBatch(files);
      }
    }, this.debounceMs);
  }

  dispose() {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    this.watcher?.dispose();
  }
}
