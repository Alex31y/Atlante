import * as vscode from 'vscode';
import type { ExtensionToWebviewMessage, WebviewToExtensionMessage } from '../../shared/types/messages';

export class DiagramPanelProvider {
  private panel: vscode.WebviewPanel | undefined;
  private readonly context: vscode.ExtensionContext;

  onInventoryRequest?: () => void;
  onInventoryRefresh?: () => void;
  onFileOpenRequest?: (filePath: string) => void;
  onDebugLog?: (payload: import('../../shared/types/messages').DebugLogMessage['payload']) => void;
  onSwitchProjectRequest?: () => void;
  onReadyCallback?: () => void;
  onDisposeCallback?: () => void;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
  }

  show() {
    if (this.panel) {
      this.panel.reveal(vscode.ViewColumn.Beside);
      return;
    }

    this.panel = vscode.window.createWebviewPanel(
      'atlante.diagramPanel',
      'Atlante',
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webview'),
        ],
      },
    );

    this.panel.webview.html = this.getWebviewHtml();
    this.panel.webview.onDidReceiveMessage(
      (message: WebviewToExtensionMessage) => this.handleWebviewMessage(message),
      undefined,
      this.context.subscriptions,
    );

    this.panel.onDidDispose(() => {
      this.panel = undefined;
      this.onDisposeCallback?.();
    });
  }

  dispose() {
    this.panel?.dispose();
  }

  sendMessage(message: ExtensionToWebviewMessage) {
    this.panel?.webview.postMessage(message);
  }

  private handleWebviewMessage(message: WebviewToExtensionMessage) {
    switch (message.type) {
      case 'inventory:request':
        this.onInventoryRequest?.();
        break;
      case 'inventory:refresh':
        this.onInventoryRefresh?.();
        break;
      case 'file:open':
        this.onFileOpenRequest?.(message.payload.filePath);
        break;
      case 'debug:log':
        this.onDebugLog?.(message.payload);
        break;
      case 'project:switch':
        this.onSwitchProjectRequest?.();
        break;
      case 'webview:ready':
        this.onReadyCallback?.();
        break;
    }
  }

  private getWebviewHtml(): string {
    const webviewUri = this.panel!.webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webview', 'index.js'),
    );
    const nonce = getNonce();

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy"
    content="default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline';">
  <title>Atlante</title>
  <style>
    :root {
      --atlante-canvas-bg: #FFFDF7;
      --atlante-card-bg: #ffffff;
      --atlante-surface-bg: #f7f5f0;
      --atlante-text-primary: #3D3929;
      --atlante-text-secondary: #6b6560;
      --atlante-text-tertiary: #9a9590;
      --atlante-border-default: #e5e2db;
      --atlante-border-subtle: #ede9e1;
      --atlante-accent-primary: #3D3929;
      --atlante-accent-hover: #2e2b1f;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 0;
      overflow: hidden;
      background: var(--atlante-canvas-bg);
      color: var(--atlante-text-primary);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
      -webkit-font-smoothing: antialiased;
    }
    #root {
      width: 100vw;
      height: 100vh;
    }
    button,
    input,
    select {
      font-family: inherit;
    }
  </style>
</head>
<body>
  <div id="root"></div>
  <script nonce="${nonce}" src="${webviewUri}"></script>
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
