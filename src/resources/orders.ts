import type { HttpClient } from '../http-client.js';
import { fetchCursorPage, ResourceBase, type CursorPage, type PageOptions } from './base.js';
import type { Cents } from './base.js';

export interface Order {
  id: string;
  status: string;
  amount: Cents;
  paymentMethod?: 'PIX' | 'CARD' | string;
  customerId?: string | null;
  createdAt?: string;
  [key: string]: unknown;
}

export interface OrderCounts {
  [group: string]: unknown;
}

export class OrdersResource extends ResourceBase {
  constructor(client: HttpClient) {
    super(client);
  }

  list(options?: (PageOptions & { status?: string }) & { signal?: AbortSignal }): Promise<CursorPage<Order>> {
    const query = ResourceBase.query({
      cursor: options?.cursor,
      limit: options?.limit,
      status: options?.status,
    });
    return fetchCursorPage<Order>(this.client, '/v1/orders', query, options);
  }

  iterate(options?: (PageOptions & { status?: string }) & { signal?: AbortSignal }) {
    return this.iteratePages<Order>(
      (page) => this.list({ ...options, cursor: page.cursor, limit: page.limit ?? options?.limit }),
      options,
    );
  }

  get(id: string, options?: { signal?: AbortSignal }): Promise<Order> {
    return this.client.get<Order>(`/v1/orders/${id}`, undefined, options);
  }

  /** Contadores agregados para dashboards — mais barato que contar na listagem. */
  counts(query?: Record<string, unknown>, options?: { signal?: AbortSignal }): Promise<OrderCounts> {
    return this.client.get<OrderCounts>('/v1/orders/counts', query, options);
  }
}
