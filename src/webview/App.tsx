import React, { useEffect, useState } from 'react';
import type { ExtensionToWebviewMessage, WebviewToExtensionMessage } from '../shared/types/messages';
import type { FileInventoryPayload } from '../shared/types/inventory';
import { SourceInventoryPage } from './components/SourceInventoryPage';

declare const acquireVsCodeApi: () => {
  postMessage: (message: WebviewToExtensionMessage) => void;
};

const vscode = acquireVsCodeApi();

type InventoryStatus = 'idle' | 'analyzing' | 'complete' | 'error' | 'stale';

function postDebugLog(
  level: 'info' | 'warn' | 'error',
  message: string,
  details?: unknown,
): void {
  vscode.postMessage({
    type: 'debug:log',
    payload: {
      source: 'webview',
      level,
      message,
      details,
    },
  } satisfies WebviewToExtensionMessage);
}

export function App() {
  const [inventory, setInventory] = useState<FileInventoryPayload | null>(null);
  const [status, setStatus] = useState<InventoryStatus>('idle');
  const [statusMessage, setStatusMessage] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [workspaceName, setWorkspaceName] = useState('Project');

  useEffect(() => {
    const handleMessage = (event: MessageEvent<ExtensionToWebviewMessage>) => {
      const message = event.data;
      postDebugLog('info', 'Received extension message.', { type: message.type });

      switch (message.type) {
        case 'inventory:data':
          if ('loading' in message.payload) {
            setStatus('analyzing');
            setError(null);
            return;
          }
          if ('error' in message.payload) {
            setError(message.payload.error);
            setStatus('error');
            return;
          }
          setInventory(message.payload);
          setError(null);
          break;
        case 'inventory:status':
          setStatus(message.payload.status);
          setStatusMessage(message.payload.message);
          break;
        case 'project:switched':
          setWorkspaceName(message.payload.workspaceName);
          if (!message.payload.hasCache) {
            setInventory(null);
            setError(null);
            setStatus('idle');
            setStatusMessage(undefined);
          }
          break;
      }
    };

    const handleWindowError = (event: ErrorEvent) => {
      postDebugLog('error', 'Unhandled window error in webview.', {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        error: event.error instanceof Error ? { message: event.error.message, stack: event.error.stack } : event.error,
      });
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      postDebugLog('error', 'Unhandled promise rejection in webview.', event.reason);
    };

    window.addEventListener('message', handleMessage);
    window.addEventListener('error', handleWindowError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    vscode.postMessage({ type: 'webview:ready' });
    return () => {
      window.removeEventListener('message', handleMessage);
      window.removeEventListener('error', handleWindowError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  const handleAnalyze = () => {
    vscode.postMessage({ type: 'inventory:request' });
  };

  const handleRefresh = () => {
    vscode.postMessage({ type: 'inventory:refresh' });
  };

  const handleSwitchProject = () => {
    vscode.postMessage({ type: 'project:switch' });
  };

  const handleOpenFile = (filePath: string) => {
    vscode.postMessage({
      type: 'file:open',
      payload: { filePath },
    });
  };

  return (
    <SourceInventoryPage
      workspaceName={workspaceName}
      inventory={inventory}
      status={status}
      statusMessage={statusMessage}
      error={error}
      onAnalyze={handleAnalyze}
      onRefresh={handleRefresh}
      onSwitchProject={handleSwitchProject}
      onOpenFile={handleOpenFile}
    />
  );
}
