import type { HttpClient } from '../http-client.js';
import { fetchCursorPage, ResourceBase, type CursorPage, type PageOptions } from './base.js';

export interface FundsRelease {
  id: string;
  status?: string;
  scheduledFor?: string;
  amountMinor?: number;
  blockedBy?: string[];
  [key: string]: unknown;
}

export class FundsReleasesResource extends ResourceBase {
  constructor(client: HttpClient) {
    super(client);
  }

  list(options?: PageOptions & { signal?: AbortSignal }): Promise<CursorPage<FundsRelease>> {
    return fetchCursorPage<FundsRelease>(this.client, '/v1/funds/releases', ResourceBase.query(options ?? {}), options);
  }

  iterate(options?: PageOptions & { signal?: AbortSignal }) {
    return this.iteratePages<FundsRelease>(
      (page) => this.list({ ...options, cursor: page.cursor, limit: page.limit ?? options?.limit }),
      options,
    );
  }

  /** Datas futuras de liberação e valores previstos — projeção de caixa. */
  calendar(query?: Record<string, unknown>, options?: { signal?: AbortSignal }): Promise<unknown> {
    return this.client.get('/v1/funds/releases/calendar', query, options);
  }

  /** Totais de liberações por período. */
  summary(query?: Record<string, unknown>, options?: { signal?: AbortSignal }): Promise<unknown> {
    return this.client.get('/v1/funds/releases/summary', query, options);
  }
}
