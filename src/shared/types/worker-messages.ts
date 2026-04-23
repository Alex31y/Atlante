import type { FileStructure } from './architecture';

export type AstWorkerRequest =
  | AstInitRequest
  | AstParseRequest
  | AstParseBatchRequest;

export interface AstInitRequest {
  type: 'ast:init';
  payload: {
    grammarsDir: string;
  };
}

export interface AstParseRequest {
  type: 'ast:parse';
  requestId: string;
  payload: {
    filePath: string;
    content: string;
    language: string;
  };
}

export interface AstParseBatchRequest {
  type: 'ast:parseBatch';
  requestId: string;
  payload: Array<{
    filePath: string;
    content: string;
    language: string;
  }>;
}

export type AstWorkerResponse =
  | AstInitResponse
  | AstParseResponse
  | AstParseBatchResponse
  | AstErrorResponse;

export interface AstInitResponse {
  type: 'ast:initComplete';
  payload: { loadedLanguages: string[] };
}

export interface AstParseResponse {
  type: 'ast:parseResult';
  requestId: string;
  payload: FileStructure;
}

export interface AstParseBatchResponse {
  type: 'ast:parseBatchResult';
  requestId: string;
  payload: FileStructure[];
}

export interface AstErrorResponse {
  type: 'ast:error';
  requestId?: string;
  error: string;
}

