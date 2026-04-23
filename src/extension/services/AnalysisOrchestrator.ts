import * as crypto from 'crypto';
import * as path from 'path';
import * as vscode from 'vscode';
import { Worker } from 'worker_threads';
import type { FileStructure } from '../../shared/types/architecture';
import { SUPPORTED_EXTENSIONS } from '../../shared/constants';
import type { ExtensionToWebviewMessage } from '../../shared/types/messages';
import type { FileInventoryPayload } from '../../shared/types/inventory';
import type {
  AstWorkerRequest,
  AstWorkerResponse,
} from '../../shared/types/worker-messages';
import { ProjectStorageService } from './ProjectStorageService';
import { buildFileInventory } from './SourceInventoryBuilder';

type PostMessageFn = (message: ExtensionToWebviewMessage) => void;

export class AnalysisOrchestrator {
  private postMessage: PostMessageFn;
  private astWorker: Worker | null = null;
  private astWorkerReady = false;
  private requestCounter = 0;
  private lastInventoryPayload: FileInventoryPayload | null = null;
  private readonly fileHashes = new Map<string, string>();
  private readonly pendingChangedPaths = new Set<string>();
  private readonly pendingHashes = new Map<string, string>();

  private static readonly AST_BATCH_SIZE = 50;
  private static readonly LARGE_FILE_THRESHOLD = 500_000;

  constructor(
    private readonly context: vscode.ExtensionContext,
    postMessage: PostMessageFn,
    private readonly workspaceRootUri: vscode.Uri,
  ) {
    this.postMessage = postMessage;
  }

  setPostMessage(fn: PostMessageFn): void {
    this.postMessage = fn;
  }

  getWorkspaceName(): string {
    const segments = this.workspaceRootUri.path.split('/');
    return segments[segments.length - 1] || 'unknown';
  }

  getRootUri(): vscode.Uri {
    return this.workspaceRootUri;
  }

  getLastInventory(): FileInventoryPayload | null {
    return this.lastInventoryPayload;
  }

  async restoreInventoryFromCache(): Promise<FileInventoryPayload | null> {
    if (this.lastInventoryPayload) {
      return this.lastInventoryPayload;
    }
    const cached = await ProjectStorageService.readInventory(this.workspaceRootUri);
    const hashes = await ProjectStorageService.readHashes(this.workspaceRootUri);
    this.fileHashes.clear();
    for (const [filePath, fileHash] of hashes ?? []) {
      this.fileHashes.set(filePath, fileHash);
    }
    this.lastInventoryPayload = cached ?? null;
    return this.lastInventoryPayload;
  }

  async analyzeSourceInventory(workspaceRoot: string): Promise<void> {
    const startedAt = Date.now();

    try {
      this.postMessage({ type: 'inventory:data', payload: { loading: true } });
      this.postMessage({
        type: 'inventory:status',
        payload: { status: 'analyzing', message: 'Scanning source files...' },
      });

      const files = await this.discoverFiles(workspaceRoot);
      if (files.length === 0) {
        await this.failInventory('No supported source files were found in this workspace.');
        return;
      }

      this.postMessage({
        type: 'inventory:status',
        payload: { status: 'analyzing', message: `Parsing ${files.length} files...`, progress: 35 },
      });

      const fileStructures = await this.parseFiles(files, workspaceRoot);
      if (fileStructures.length === 0) {
        await this.failInventory('No source files could be parsed for inventory generation.');
        return;
      }

      this.postMessage({
        type: 'inventory:status',
        payload: { status: 'analyzing', message: 'Building source inventory...', progress: 75 },
      });

      const inventory = buildFileInventory(fileStructures, workspaceRoot, {
        analyzedAt: Date.now(),
        analysisTimeMs: Date.now() - startedAt,
        parserMode: 'mixed',
      });

      this.pendingChangedPaths.clear();
      this.pendingHashes.clear();
      this.lastInventoryPayload = inventory;
      await Promise.all([
        ProjectStorageService.writeInventory(this.workspaceRootUri, inventory),
        ProjectStorageService.writeHashes(
          this.workspaceRootUri,
          [...this.fileHashes.entries()].sort((left, right) => left[0].localeCompare(right[0])),
        ),
      ]);

      this.postMessage({ type: 'inventory:data', payload: inventory });
      this.postMessage({
        type: 'inventory:status',
        payload: { status: 'complete', message: 'Source inventory ready.', progress: 100 },
      });
    } catch (err) {
      await this.failInventory(err instanceof Error ? err.message : String(err));
    }
  }

  async handleFileChange(changedFiles: string[]): Promise<void> {
    if (!this.lastInventoryPayload) return;

    try {
      for (const filePath of changedFiles) {
        try {
          const uri = vscode.Uri.file(filePath);
          const raw = await vscode.workspace.fs.readFile(uri);
          const content = new TextDecoder().decode(raw);
          const hash = this.computeFileHash(content);
          const normalizedPath = this.normalizePath(filePath);
          const oldHash = this.fileHashes.get(normalizedPath);

          if (hash !== oldHash) {
            this.pendingChangedPaths.add(filePath);
            this.pendingHashes.set(normalizedPath, hash);
          }
        } catch {
          this.pendingChangedPaths.add(filePath);
        }
      }

      if (this.pendingChangedPaths.size === 0) return;

      const count = this.pendingChangedPaths.size;
      this.postMessage({
        type: 'inventory:status',
        payload: {
          status: 'stale',
          message: `Files changed. Refresh inventory. (${count})`,
        },
      });
    } catch (err) {
      console.warn('[Atlante] Change detection failed:', err);
    }
  }

  dispose(): void {
    this.astWorker?.terminate();
    this.astWorker = null;
    this.astWorkerReady = false;
  }

  private async failInventory(message: string): Promise<void> {
    this.lastInventoryPayload = null;
    this.postMessage({ type: 'inventory:data', payload: { error: message } });
    this.postMessage({
      type: 'inventory:status',
      payload: { status: 'error', message },
    });
  }

  private normalizePath(filePath: string): string {
    return filePath.replace(/\\/g, '/');
  }

  private computeFileHash(content: string): string {
    return crypto.createHash('sha256').update(content).digest('hex').slice(0, 16);
  }

  private getWorkerPath(workerName: string): string {
    return path.join(this.context.extensionPath, 'dist', 'workers', `${workerName}.js`);
  }

  private spawnAstWorker(): Worker {
    if (this.astWorker) return this.astWorker;

    this.astWorker = new Worker(this.getWorkerPath('ast-worker'));
    this.astWorker.on('error', (err) => {
      console.error('[Atlante] AST Worker error:', err);
      this.astWorker = null;
      this.astWorkerReady = false;
    });
    this.astWorker.on('exit', (code) => {
      if (code !== 0) {
        console.warn(`[Atlante] AST Worker exited with code ${code}`);
      }
      this.astWorker = null;
      this.astWorkerReady = false;
    });

    return this.astWorker;
  }

  private sendToWorker<Req, Res>(
    worker: Worker,
    message: Req,
    filter: (msg: Res) => boolean,
    timeoutMs = 60_000,
  ): Promise<Res> {
    return new Promise<Res>((resolve, reject) => {
      const timeout = setTimeout(() => {
        worker.off('message', handler);
        reject(new Error(`Worker response timeout (${Math.round(timeoutMs / 1000)}s)`));
      }, timeoutMs);

      function handler(msg: Res) {
        if (filter(msg)) {
          clearTimeout(timeout);
          worker.off('message', handler);
          resolve(msg);
        }
      }

      worker.on('message', handler);
      worker.postMessage(message);
    });
  }

  private async ensureAstWorkerReady(): Promise<Worker> {
    const worker = this.spawnAstWorker();

    if (!this.astWorkerReady) {
      const grammarsDir = path.join(this.context.extensionPath, 'dist', 'grammars');
      const result = await this.sendToWorker<AstWorkerRequest, AstWorkerResponse>(
        worker,
        { type: 'ast:init', payload: { grammarsDir } },
        (msg) => msg.type === 'ast:initComplete' || msg.type === 'ast:error',
      );

      if (result.type === 'ast:error') {
        console.warn(`[Atlante] AST Worker init warning: ${result.error}`);
      }
      this.astWorkerReady = true;
    }

    return worker;
  }

  private async discoverFiles(workspaceRoot: string): Promise<string[]> {
    const config = vscode.workspace.getConfiguration('archlens');
    const excludePatterns = config.get<string[]>('excludePatterns') ?? [];
    const maxFiles = config.get<number>('maxFilesForFullAnalysis') ?? 500;
    const extensions = Object.keys(SUPPORTED_EXTENSIONS).map((ext) => ext.slice(1));
    const includeGlob = `**/*.{${extensions.join(',')}}`;

    const uris = await vscode.workspace.findFiles(
      new vscode.RelativePattern(workspaceRoot, includeGlob),
      `{${excludePatterns.join(',')}}`,
      maxFiles,
    );

    return uris.map((uri) => uri.fsPath);
  }

  private async parseFiles(filePaths: string[], _workspaceRoot: string): Promise<FileStructure[]> {
    const astWorker = await this.ensureAstWorkerReady();
    const allFiles: Array<{ filePath: string; content: string; language: string }> = [];

    for (const filePath of filePaths) {
      try {
        const ext = path.extname(filePath);
        const language = SUPPORTED_EXTENSIONS[ext];
        if (!language) continue;

        const raw = await vscode.workspace.fs.readFile(vscode.Uri.file(filePath));
        const content = new TextDecoder().decode(raw);

        if (content.length > AnalysisOrchestrator.LARGE_FILE_THRESHOLD) {
          console.log(`[Atlante] Large file (${(content.length / 1024).toFixed(0)}KB): ${filePath}`);
        }

        allFiles.push({ filePath, content, language });
        this.fileHashes.set(this.normalizePath(filePath), this.computeFileHash(content));
      } catch {
        // Skip unreadable files.
      }
    }

    if (allFiles.length === 0) return [];

    const results: FileStructure[] = [];
    const batchSize = AnalysisOrchestrator.AST_BATCH_SIZE;

    for (let i = 0; i < allFiles.length; i += batchSize) {
      const batch = allFiles.slice(i, i + batchSize);
      const requestId = `batch-${++this.requestCounter}`;
      const timeoutMs = 30_000 + batch.length * 1_000;

      try {
        const response = await this.sendToWorker<AstWorkerRequest, AstWorkerResponse>(
          astWorker,
          { type: 'ast:parseBatch', requestId, payload: batch },
          (msg) =>
            (msg.type === 'ast:parseBatchResult' && msg.requestId === requestId)
            || (msg.type === 'ast:error' && msg.requestId === requestId),
          timeoutMs,
        );

        if (response.type === 'ast:parseBatchResult') {
          results.push(...response.payload);
        } else if (response.type === 'ast:error') {
          console.warn(`[Atlante] AST batch error: ${response.error}`);
        }
      } catch (err) {
        console.warn('[Atlante] AST batch failed:', err);
      }

      const progress = 35 + Math.round(((i + batch.length) / allFiles.length) * 35);
      this.postMessage({
        type: 'inventory:status',
        payload: {
          status: 'analyzing',
          message: `Parsing files (${Math.min(i + batch.length, allFiles.length)}/${allFiles.length})...`,
          progress,
        },
      });
    }

    return results;
  }
}
