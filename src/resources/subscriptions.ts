import type { HttpClient } from '../http-client.js';
import { fetchCursorPage, ResourceBase, type CursorPage, type PageOptions } from './base.js';

export interface Subscription {
  id: string;
  status?: string;
  offerId?: string | null;
  customerId?: string | null;
  [key: string]: unknown;
}

export interface SubscriptionInvoice {
  id: string;
  amountMinor?: number;
  status?: string;
  [key: string]: unknown;
}

export class SubscriptionsResource extends ResourceBase {
  constructor(client: HttpClient) {
    super(client);
  }

  list(options?: (PageOptions & { status?: string }) & { signal?: AbortSignal }): Promise<CursorPage<Subscription>> {
    const query = ResourceBase.query({
      cursor: options?.cursor,
      limit: options?.limit,
      status: options?.status,
    });
    return fetchCursorPage<Subscription>(this.client, '/v1/subscriptions', query, options);
  }

  iterate(options?: (PageOptions & { status?: string }) & { signal?: AbortSignal }) {
    return this.iteratePages<Subscription>(
      (page) => this.list({ ...options, cursor: page.cursor, limit: page.limit ?? options?.limit }),
      options,
    );
  }

  get(id: string, options?: { signal?: AbortSignal }): Promise<Subscription> {
    return this.client.get<Subscription>(`/v1/subscriptions/${id}`, undefined, options);
  }

  /** Faturas por ciclo — base da conciliação de recorrência. */
  listInvoices(id: string, options?: PageOptions & { signal?: AbortSignal }): Promise<CursorPage<SubscriptionInvoice>> {
    return fetchCursorPage<SubscriptionInvoice>(this.client, `/v1/subscriptions/${id}/invoices`, ResourceBase.query(options ?? {}), options);
  }

  /** Cancela imediatamente: nenhuma fatura nova; as pagas não são afetadas. */
  cancel(id: string, options?: { idempotencyKey?: string; signal?: AbortSignal }): Promise<void> {
    return this.client.post<void>(`/v1/subscriptions/${id}/cancel`, undefined, options);
  }
}
