import type { FileInventoryPayload } from './inventory';

export type ExtensionToWebviewMessage =
  | InventoryDataMessage
  | InventoryStatusMessage
  | ProjectSwitchedMessage;

export interface InventoryDataMessage {
  type: 'inventory:data';
  payload:
    | { loading: true }
    | FileInventoryPayload
    | { error: string };
}

export interface InventoryStatusMessage {
  type: 'inventory:status';
  payload: {
    status: 'idle' | 'analyzing' | 'complete' | 'error' | 'stale';
    message?: string;
    progress?: number;
  };
}

export interface ProjectSwitchedMessage {
  type: 'project:switched';
  payload: {
    workspaceName: string;
    workspaceKey: string;
    hasCache: boolean;
  };
}

export type WebviewToExtensionMessage =
  | InventoryRequestMessage
  | InventoryRefreshMessage
  | WebviewReadyMessage
  | FileOpenMessage
  | DebugLogMessage
  | SwitchProjectMessage;

export interface InventoryRequestMessage {
  type: 'inventory:request';
}

export interface InventoryRefreshMessage {
  type: 'inventory:refresh';
}

export interface WebviewReadyMessage {
  type: 'webview:ready';
}

export interface FileOpenMessage {
  type: 'file:open';
  payload: {
    filePath: string;
  };
}

export interface DebugLogMessage {
  type: 'debug:log';
  payload: {
    source: 'webview';
    level: 'info' | 'warn' | 'error';
    message: string;
    details?: unknown;
  };
}

export interface SwitchProjectMessage {
  type: 'project:switch';
}
