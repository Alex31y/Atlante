import * as vscode from 'vscode';
import type { ExtensionToWebviewMessage } from '../shared/types/messages';
import type { ProjectSummary } from '../shared/types/projects';
import { DiagramPanelProvider } from './providers/DiagramPanelProvider';
import { SidebarViewProvider } from './providers/SidebarViewProvider';
import { AnalysisOrchestrator } from './services/AnalysisOrchestrator';
import { ProjectRegistryService } from './services/ProjectRegistryService';
import { ProjectStorageService } from './services/ProjectStorageService';
import { FileWatcher } from './watchers/FileWatcher';

let diagramPanel: DiagramPanelProvider | undefined;
let orchestrator: AnalysisOrchestrator | undefined;
let fileWatcher: FileWatcher | undefined;
let activeRootUri: vscode.Uri | undefined;
let registry: ProjectRegistryService | undefined;
let sidebarProvider: SidebarViewProvider | undefined;
let debugChannel: vscode.OutputChannel | undefined;

function logDebug(message: string, details?: unknown, level: 'info' | 'warn' | 'error' = 'info'): void {
  const channel = debugChannel;
  const timestamp = new Date().toISOString();
  const prefix = level.toUpperCase();
  channel?.appendLine(`[${timestamp}] [${prefix}] ${message}`);

  if (details !== undefined) {
    channel?.appendLine(formatDebugDetails(details));
  }

  if (level === 'error') {
    channel?.show(true);
  }
}

function formatDebugDetails(details: unknown): string {
  if (details instanceof Error) {
    return details.stack ?? details.message;
  }

  try {
    return JSON.stringify(details, null, 2);
  } catch {
    return String(details);
  }
}

function getActiveRoot(): vscode.Uri | undefined {
  return activeRootUri ?? vscode.workspace.workspaceFolders?.[0]?.uri;
}

function getWorkspaceKey(uri: vscode.Uri): string {
  return uri.fsPath;
}

async function registerCurrentProject(): Promise<void> {
  if (!orchestrator || !registry) {
    return;
  }

  const inventory = await orchestrator.restoreInventoryFromCache();
  const summary: ProjectSummary | undefined = inventory ? {
    fileCount: inventory.summary.totalFiles,
    internalDependencyEdges: inventory.summary.internalDependencyEdges,
    languages: inventory.summary.languages.map((entry) => entry.language),
    analyzedAt: new Date(inventory.metadata.analyzedAt).toISOString(),
  } : undefined;

  await registry.upsert({
    fsPath: orchestrator.getRootUri().fsPath,
    name: orchestrator.getWorkspaceName(),
    summary,
  });

  sidebarProvider?.setProjects(registry.getAll());
}

function forwardOrchestratorMessage(rootUri: vscode.Uri, message: ExtensionToWebviewMessage): void {
  logDebug('Forwarding orchestrator message to panel.', {
    type: message.type,
    workspaceKey: getWorkspaceKey(rootUri),
  });

  diagramPanel?.sendMessage(message);
}

async function sendCurrentPanelState(panel: DiagramPanelProvider): Promise<void> {
  if (!orchestrator) {
    logDebug('Skipped sendCurrentPanelState because orchestrator is missing.', undefined, 'warn');
    return;
  }

  const inventory = await orchestrator.restoreInventoryFromCache();
  const rootUri = orchestrator.getRootUri();

  panel.sendMessage({
    type: 'project:switched',
    payload: {
      workspaceName: orchestrator.getWorkspaceName(),
      workspaceKey: getWorkspaceKey(rootUri),
      hasCache: inventory !== null,
    },
  });

  if (inventory) {
    panel.sendMessage({ type: 'inventory:data', payload: inventory });
    panel.sendMessage({
      type: 'inventory:status',
      payload: { status: 'complete', message: 'Source inventory ready.', progress: 100 },
    });
  }
}

function wirePanelCallbacks(panel: DiagramPanelProvider): void {
  panel.onInventoryRequest = () => {
    const rootPath = getActiveRoot()?.fsPath;
    logDebug('Inventory request received from panel.', { rootPath });
    if (rootPath) {
      void orchestrator?.analyzeSourceInventory(rootPath).then(() => registerCurrentProject());
    }
  };
  panel.onInventoryRefresh = () => {
    const rootPath = getActiveRoot()?.fsPath;
    logDebug('Inventory refresh received from panel.', { rootPath });
    if (rootPath) {
      void orchestrator?.analyzeSourceInventory(rootPath).then(() => registerCurrentProject());
    }
  };
  panel.onFileOpenRequest = (filePath) => {
    void openInventoryFile(filePath);
  };
  panel.onReadyCallback = async () => {
    logDebug('Panel signaled webview:ready.');
    await sendCurrentPanelState(panel);
  };
  panel.onDebugLog = (payload) => {
    logDebug(`[webview] ${payload.message}`, payload.details, payload.level);
  };
  panel.onSwitchProjectRequest = async () => {
    const uris = await vscode.window.showOpenDialog({
      canSelectFiles: false,
      canSelectFolders: true,
      canSelectMany: false,
      openLabel: 'Open Project',
    });
    if (uris?.[0]) {
      vscode.commands.executeCommand('archlens.switchProject', uris[0]);
    }
  };
  panel.onDisposeCallback = () => {
    logDebug('Panel disposed.');
    diagramPanel = undefined;
  };
}

function getWorkspaceDisplayName(root: vscode.Uri): string {
  return vscode.workspace.getWorkspaceFolder(root)?.name
    ?? root.path.split('/').at(-1)
    ?? root.fsPath;
}

async function openInventoryFile(filePath: string): Promise<void> {
  const root = getActiveRoot();
  if (!root) {
    void vscode.window.showWarningMessage('Atlante: No workspace folder available to open the file.');
    logDebug('Open file aborted because no active root is available.', { filePath }, 'warn');
    return;
  }

  const normalizedSegments = filePath
    .split(/[\\/]+/)
    .filter((segment) => segment.length > 0 && segment !== '.');
  const targetUri = vscode.Uri.joinPath(root, ...normalizedSegments);

  try {
    const document = await vscode.workspace.openTextDocument(targetUri);
    await vscode.window.showTextDocument(document, {
      preview: false,
      preserveFocus: false,
      viewColumn: vscode.ViewColumn.Active,
    });
    logDebug('Opened file from inventory.', {
      filePath,
      resolvedPath: targetUri.fsPath,
    });
  } catch (error) {
    logDebug('Failed to open file from inventory.', {
      filePath,
      resolvedPath: targetUri.fsPath,
      error,
    }, 'error');
    void vscode.window.showErrorMessage(`Atlante: Unable to open ${filePath}.`);
  }
}

function ensureOrchestratorSession(context: vscode.ExtensionContext, root: vscode.Uri): void {
  const rootChanged = orchestrator
    ? orchestrator.getRootUri().toString() !== root.toString()
    : false;

  if (rootChanged) {
    orchestrator?.dispose();
    orchestrator = undefined;
    fileWatcher?.dispose();
    fileWatcher = undefined;
  }

  activeRootUri = root;
  sidebarProvider?.setActiveProject(root);

  if (!orchestrator) {
    orchestrator = new AnalysisOrchestrator(
      context,
      (message) => { forwardOrchestratorMessage(root, message); },
      root,
    );
  } else {
    orchestrator.setPostMessage((message) => {
      const rootUri = orchestrator?.getRootUri() ?? root;
      forwardOrchestratorMessage(rootUri, message);
    });
  }
}

function ensurePanelSession(context: vscode.ExtensionContext, root: vscode.Uri): void {
  logDebug('Ensuring panel session.', {
    root: root.fsPath,
    hasPanel: diagramPanel !== undefined,
    hasOrchestrator: orchestrator !== undefined,
  });
  ensureOrchestratorSession(context, root);
  if (!diagramPanel) {
    diagramPanel = new DiagramPanelProvider(context);
  }

  wirePanelCallbacks(diagramPanel);
  diagramPanel.show();
}

export function activate(context: vscode.ExtensionContext) {
  debugChannel = vscode.window.createOutputChannel('Atlante');
  context.subscriptions.push(debugChannel);
  console.log('Atlante is activating...');
  logDebug('Extension activating.');

  registry = new ProjectRegistryService(context);
  sidebarProvider = new SidebarViewProvider(context.extensionUri);
  sidebarProvider.onDebugMessage = (message, details) => {
    logDebug(`[sidebar] ${message}`, details);
  };

  const showDiagramCmd = vscode.commands.registerCommand('archlens.showDiagram', () => {
    const root = getActiveRoot();
    if (!root) {
      vscode.window.showWarningMessage('Atlante: No workspace folder open.');
      logDebug('Show panel aborted because no workspace folder is open.', undefined, 'warn');
      return;
    }

    logDebug('Show panel command invoked.', { root: root.fsPath });
    ensurePanelSession(context, root);
  });

  const analyzeCmd = vscode.commands.registerCommand('archlens.analyzeWorkspace', async () => {
    const root = getActiveRoot();
    if (!root) {
      vscode.window.showWarningMessage('Atlante: No workspace folder open.');
      logDebug('Analyze workspace aborted because no workspace folder is open.', undefined, 'warn');
      return;
    }

    logDebug('Analyze workspace command invoked.', { root: root.fsPath });
    ensurePanelSession(context, root);
    await orchestrator?.analyzeSourceInventory(root.fsPath);
    await registerCurrentProject();

    if (!fileWatcher) {
      fileWatcher = new FileWatcher((changedFiles) => {
        const currentRoot = getActiveRoot()?.fsPath;
        const relevant = currentRoot
          ? changedFiles.filter((filePath) => filePath.startsWith(currentRoot))
          : changedFiles;
        if (relevant.length > 0) {
          orchestrator?.handleFileChange(relevant);
        }
      });
      fileWatcher.start();
      context.subscriptions.push(fileWatcher);
    }
  });

  const refreshCmd = vscode.commands.registerCommand('archlens.refreshDiagram', () => {
    logDebug('Refresh command invoked.');
    void vscode.commands.executeCommand('archlens.analyzeWorkspace');
  });

  const switchProjectCmd = vscode.commands.registerCommand('archlens.switchProject', async (folderUri?: vscode.Uri) => {
    let targetUri = folderUri;
    if (!targetUri && registry) {
      const projects = registry.getAll();
      if (projects.length === 0) {
        return;
      }
      const picked = await vscode.window.showQuickPick(
        projects.map((project) => ({ label: project.name, description: project.fsPath, uri: vscode.Uri.file(project.fsPath) })),
        { placeHolder: 'Select a project' },
      );
      if (!picked) {
        return;
      }
      targetUri = picked.uri;
    }
    if (!targetUri) {
      logDebug('Switch project aborted because no target was selected.', undefined, 'warn');
      return;
    }
    if (activeRootUri?.toString() === targetUri.toString()) {
      logDebug('Switch project ignored because target is already active.', { root: targetUri.fsPath });
      return;
    }

    logDebug('Switching project.', { root: targetUri.fsPath });
    orchestrator?.dispose();
    orchestrator = undefined;
    fileWatcher?.dispose();
    fileWatcher = undefined;
    activeRootUri = targetUri;
    sidebarProvider?.setActiveProject(targetUri);

    if (diagramPanel) {
      ensurePanelSession(context, targetUri);
      await sendCurrentPanelState(diagramPanel);
    }
  });

  const removeProjectCmd = vscode.commands.registerCommand('archlens.removeProject', async (fsPath: string) => {
    if (!registry) {
      logDebug('Remove project skipped because registry service is missing.', undefined, 'warn');
      return;
    }

    const root = vscode.Uri.file(fsPath);
    const workspaceName = getWorkspaceDisplayName(root);
    const confirmed = await vscode.window.showWarningMessage(
      `Delete all Atlante data for ${workspaceName}?`,
      {
        modal: true,
        detail: 'This removes saved source inventory data for this workspace.',
      },
      'Delete',
    );
    if (confirmed !== 'Delete') {
      logDebug('Remove project cancelled by user.', { fsPath });
      return;
    }

    logDebug('Removing project.', { fsPath });
    await ProjectStorageService.deleteProjectData(root);
    await registry.remove(fsPath);
    sidebarProvider?.setProjects(registry.getAll());

    const isActiveProject = orchestrator?.getRootUri().fsPath === fsPath || activeRootUri?.fsPath === fsPath;
    if (isActiveProject) {
      orchestrator?.dispose();
      orchestrator = undefined;
      fileWatcher?.dispose();
      fileWatcher = undefined;

      diagramPanel?.sendMessage({
        type: 'project:switched',
        payload: {
          workspaceName,
          workspaceKey: fsPath,
          hasCache: false,
        },
      });
      diagramPanel?.sendMessage({
        type: 'inventory:status',
        payload: { status: 'idle', message: 'Atlante data deleted for this workspace.' },
      });
    }

    void vscode.window.showInformationMessage(`Deleted Atlante data for ${workspaceName}.`);
  });

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(SidebarViewProvider.viewType, sidebarProvider),
  );

  registry.validate().then(() => {
    logDebug('Registry validation completed.', { projects: registry?.getAll().length ?? 0 });
    sidebarProvider?.setProjects(registry!.getAll());
    const root = getActiveRoot();
    if (root) {
      sidebarProvider?.setActiveProject(root);
    }
  }).catch((err) => {
    console.warn('[Atlante] Registry validation failed:', err);
    logDebug('Registry validation failed.', err, 'error');
  });

  context.subscriptions.push(showDiagramCmd, analyzeCmd, refreshCmd, switchProjectCmd, removeProjectCmd);
  console.log('Atlante activated.');
  logDebug('Extension activated.');
}
