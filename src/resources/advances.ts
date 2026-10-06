import type { HttpClient } from '../http-client.js';
import { fetchCursorPage, ResourceBase, type CursorPage, type PageOptions } from './base.js';
import type { Cents } from './base.js';

export interface AdvanceQuote {
  grossMinor?: Cents;
  feeMinor?: Cents;
  netMinor?: Cents;
  expiresAt?: string;
  [key: string]: unknown;
}

export interface AdvanceRequest {
  id: string;
  status?: string;
  [key: string]: unknown;
}

export class AdvancesResource extends ResourceBase {
  constructor(client: HttpClient) {
    super(client);
  }

  /** Recebíveis futuros elegíveis e suas datas de liberação. */
  listReceivables(options?: PageOptions & { signal?: AbortSignal }): Promise<CursorPage<Record<string, unknown>>> {
    return fetchCursorPage<Record<string, unknown>>(
      this.client,
      '/v1/advance/receivables',
      ResourceBase.query(options ?? {}),
      options,
    );
  }

  /** Se sua conta e os recebíveis atendem aos critérios de risco. */
  eligibility(query?: Record<string, unknown>, options?: { signal?: AbortSignal }): Promise<unknown> {
    return this.client.get('/v1/advance/eligibility', query, options);
  }

  /** Gera a cotação (bruto, taxa, líquido) com validade própria. */
  quote(input: Record<string, unknown>, options?: { idempotencyKey?: string; signal?: AbortSignal }): Promise<AdvanceQuote> {
    return this.client.post<AdvanceQuote>('/v1/advance/quotes', input, options);
  }

  /** Vincula a cotação e cria a solicitação (passa por revisão da Korbit). */
  create(input: Record<string, unknown>, options?: { idempotencyKey?: string; signal?: AbortSignal }): Promise<AdvanceRequest> {
    return this.client.post<AdvanceRequest>('/v1/advance/requests', input, options);
  }

  list(options?: PageOptions & { signal?: AbortSignal }): Promise<CursorPage<AdvanceRequest>> {
    return fetchCursorPage<AdvanceRequest>(this.client, '/v1/advance/requests', ResourceBase.query(options ?? {}), options);
  }

  get(id: string, options?: { signal?: AbortSignal }): Promise<AdvanceRequest> {
    return this.client.get<AdvanceRequest>(`/v1/advance/requests/${id}`, undefined, options);
  }
}
