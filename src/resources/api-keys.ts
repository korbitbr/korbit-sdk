import type { HttpClient } from '../http-client.js';
import { fetchCursorPage, ResourceBase, type CursorPage } from './base.js';

export interface ApiKey {
  id: string;
  name: string;
  scopes: string[];
  status?: string;
  expiresAt?: string | null;
  lastUsedAt?: string | null;
  /** O token completo só é retornado na criação/rotação — nunca na listagem. */
  token?: string;
  [key: string]: unknown;
}

export class ApiKeysResource extends ResourceBase {
  constructor(client: HttpClient) {
    super(client);
  }

  /** O token completo vem na resposta UMA ÚNICA VEZ — guarde em gerenciador de segredos. */
  create(input: { name: string; scopes: string[]; expiresAt?: string }, options?: { idempotencyKey?: string; signal?: AbortSignal }): Promise<ApiKey> {
    return this.client.post<ApiKey>('/v1/iam/api-keys', input, options);
  }

  list(options?: { signal?: AbortSignal }): Promise<CursorPage<ApiKey>> {
    return fetchCursorPage<ApiKey>(this.client, '/v1/iam/api-keys', undefined, options);
  }

  /** Cria o token substituto e revoga o anterior após a carência — rotação sem downtime. */
  rotate(id: string, input?: { gracePeriodSeconds?: number }, options?: { idempotencyKey?: string; signal?: AbortSignal }): Promise<ApiKey> {
    return this.client.post<ApiKey>(`/v1/iam/api-keys/${id}/rotate`, input, options);
  }

  /** Revoga imediatamente — toda chamada seguinte retorna 401. */
  revoke(id: string, options?: { idempotencyKey?: string; signal?: AbortSignal }): Promise<void> {
    return this.client.delete<void>(`/v1/iam/api-keys/${id}`, options);
  }
}
