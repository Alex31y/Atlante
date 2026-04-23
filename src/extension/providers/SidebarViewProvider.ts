import * as vscode from 'vscode';
import type { ProjectEntry } from '../../shared/types/projects';

export class SidebarViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'archlens.sidebarView';

  private view: vscode.WebviewView | undefined;
  private activeProjectPath: string | undefined;
  private projects: ProjectEntry[] = [];

  onDebugMessage?: (message: string, details?: unknown) => void;

  constructor(private readonly extensionUri: vscode.Uri) {
    void this.extensionUri;
  }

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ): void {
    this.view = webviewView;
    webviewView.webview.options = { enableScripts: true };
    webviewView.webview.html = this.getHtml();

    webviewView.webview.onDidReceiveMessage((msg: {
      command: string;
      fsPath?: string;
    }) => {
      this.onDebugMessage?.('Sidebar message received.', msg);
      if (msg.command === 'openInventory') {
        vscode.commands.executeCommand('archlens.showDiagram');
      } else if (msg.command === 'analyzeWorkspace') {
        vscode.commands.executeCommand('archlens.analyzeWorkspace');
      } else if (msg.command === 'selectProject' && msg.fsPath) {
        vscode.commands.executeCommand('archlens.switchProject', vscode.Uri.file(msg.fsPath));
      } else if (msg.command === 'removeProject' && msg.fsPath) {
        vscode.commands.executeCommand('archlens.removeProject', msg.fsPath);
      }
    });

    this.syncState();
  }

  setActiveProject(uri: vscode.Uri): void {
    this.activeProjectPath = uri.fsPath;
    this.syncState();
  }

  setProjects(projects: ProjectEntry[]): void {
    this.projects = projects;
    this.syncState();
  }

  private syncState(): void {
    if (!this.view) {
      return;
    }

    this.view.webview.postMessage({
      command: 'syncState',
      activeProjectPath: this.activeProjectPath ?? '',
      projects: this.projects,
    });
  }

  private getHtml(): string {
    const nonce = getNonce();
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy"
        content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Atlante</title>
  <style>
    body {
      margin: 0;
      padding: 12px;
      font-family: var(--vscode-font-family);
      color: var(--vscode-foreground);
      background: transparent;
    }
    .brand {
      font-size: 13px;
      font-weight: 800;
      margin-bottom: 3px;
    }
    .tagline {
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
      line-height: 1.35;
      margin-bottom: 12px;
    }
    .actions {
      display: flex;
      flex-direction: column;
      gap: 6px;
      margin-bottom: 14px;
    }
    .btn {
      border-radius: 2px;
      padding: 7px 10px;
      font-size: 12px;
      font-family: var(--vscode-font-family);
      text-align: left;
      cursor: pointer;
    }
    .btn-primary {
      border: none;
      background: #3D3929;
      color: #fff;
      font-weight: 600;
    }
    .btn-secondary {
      border: 1px solid var(--vscode-widget-border);
      background: transparent;
      color: var(--vscode-descriptionForeground);
    }
    .divider {
      border: none;
      border-top: 1px solid var(--vscode-widget-border);
      margin: 14px 0;
    }
    .section-label {
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
      margin-bottom: 8px;
    }
    .project-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .project-entry {
      padding: 9px;
      border: 1px solid var(--vscode-widget-border);
      border-radius: 2px;
      background: transparent;
    }
    .project-entry.active {
      border-color: #615b48;
      background: #f7f5f0;
      box-shadow: inset 3px 0 0 #615b48;
    }
    .project-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 8px;
      cursor: pointer;
    }
    .project-name {
      font-size: 12px;
      font-weight: 700;
      line-height: 1.35;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .project-meta {
      margin-top: 7px;
      font-size: 10px;
      line-height: 1.45;
      color: var(--vscode-descriptionForeground);
      word-break: break-word;
    }
    .project-badges {
      display: flex;
      flex-wrap: wrap;
      gap: 5px;
    }
    .project-badge {
      border: 1px solid var(--vscode-widget-border);
      padding: 2px 5px;
      background: rgba(127, 127, 127, 0.08);
      color: var(--vscode-descriptionForeground);
      font-size: 10px;
      line-height: 1.2;
    }
    .project-summary {
      flex: 1;
      min-width: 0;
    }
    .project-remove {
      border: 1px solid transparent;
      background: transparent;
      padding: 0;
      width: 20px;
      height: 20px;
      font-size: 12px;
      line-height: 1;
      color: var(--vscode-descriptionForeground);
      cursor: pointer;
    }
    .project-remove:hover {
      border-color: var(--vscode-widget-border);
      color: var(--vscode-foreground);
    }
    .empty {
      font-size: 11px;
      line-height: 1.5;
      color: var(--vscode-descriptionForeground);
      font-style: italic;
      padding: 10px 0;
    }
  </style>
</head>
<body>
  <div class="brand">Atlante</div>
  <div class="tagline">Files, lines, imports, exports, dependencies.</div>

  <div class="actions">
    <button class="btn btn-primary" id="openInventory">Open Inventory</button>
    <button class="btn btn-secondary" id="analyzeWorkspace">Analyze Workspace</button>
  </div>

  <hr class="divider" />
  <div class="section-label">Projects</div>
  <div class="project-list" id="projectList"></div>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    const projectList = document.getElementById('projectList');
    let activeProjectPath = '';

    function renderProjects(projects) {
      projectList.innerHTML = '';
      if (projects.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'empty';
        empty.textContent = 'No analyzed projects yet.';
        projectList.appendChild(empty);
        return;
      }

      for (const project of projects) {
        const entry = document.createElement('div');
        entry.className = 'project-entry' + (project.fsPath === activeProjectPath ? ' active' : '');

        const header = document.createElement('div');
        header.className = 'project-header';
        header.addEventListener('click', () => {
          if (project.fsPath !== activeProjectPath) {
            vscode.postMessage({ command: 'selectProject', fsPath: project.fsPath });
          }
        });

        const summary = document.createElement('div');
        summary.className = 'project-summary';

        const name = document.createElement('div');
        name.className = 'project-name';
        name.textContent = project.name;
        summary.appendChild(name);

        const meta = document.createElement('div');
        meta.className = 'project-meta';
        if (project.summary) {
          meta.className = 'project-meta project-badges';
          const filesBadge = document.createElement('span');
          filesBadge.className = 'project-badge';
          filesBadge.textContent = project.summary.fileCount + ' files';
          const edgesBadge = document.createElement('span');
          edgesBadge.className = 'project-badge';
          edgesBadge.textContent = project.summary.internalDependencyEdges + ' edges';
          meta.appendChild(filesBadge);
          meta.appendChild(edgesBadge);
        } else {
          meta.textContent = 'No summary yet';
        }
        summary.appendChild(meta);
        header.appendChild(summary);

        const remove = document.createElement('button');
        remove.className = 'project-remove';
        remove.type = 'button';
        remove.textContent = 'x';
        remove.title = 'Delete Atlante data for this project';
        remove.addEventListener('click', (event) => {
          event.stopPropagation();
          vscode.postMessage({ command: 'removeProject', fsPath: project.fsPath });
        });
        header.appendChild(remove);

        entry.appendChild(header);
        projectList.appendChild(entry);
      }
    }

    document.getElementById('openInventory').addEventListener('click', () => {
      vscode.postMessage({ command: 'openInventory' });
    });
    document.getElementById('analyzeWorkspace').addEventListener('click', () => {
      vscode.postMessage({ command: 'analyzeWorkspace' });
    });

    window.addEventListener('message', (event) => {
      const msg = event.data;
      if (msg.command !== 'syncState') return;
      activeProjectPath = msg.activeProjectPath || '';
      renderProjects(msg.projects || []);
    });
  </script>
</body>
</html>`;
  }
}

function getNonce(): string {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
