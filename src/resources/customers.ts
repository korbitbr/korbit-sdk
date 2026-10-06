import type { HttpClient } from '../http-client.js';
import { ResourceBase, type CursorPage, type PageOptions } from './base.js';

export interface CreateCustomerInput {
  name: string;
  email: string;
  phone?: string;
  externalId?: string;
}

export interface Customer {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  externalId?: string | null;
  status?: string;
  createdAt?: string;
  [key: string]: unknown;
}

export class CustomersResource extends ResourceBase {
  constructor(client: HttpClient) {
    super(client);
  }

  create(input: CreateCustomerInput, options?: { idempotencyKey?: string; signal?: AbortSignal }): Promise<Customer> {
    return this.client.post<Customer>('/v1/customers', input, options);
  }

  /** Lista paginada com busca por nome/e-mail. Use `iterate()` para percorrer tudo. */
  async list(options?: (PageOptions & { search?: string }) & { signal?: AbortSignal }): Promise<CursorPage<Customer>> {
    const query = ResourceBase.query({
      cursor: options?.cursor,
      limit: options?.limit,
      search: options?.search,
    });
    return ResourceBase.readPage<Customer>(
      await this.client.get('/v1/customers', query, options),
    );
  }

  iterate(options?: (PageOptions & { search?: string }) & { signal?: AbortSignal }) {
    return this.iteratePages<Customer>(
      (page) => this.list({ ...options, cursor: page.cursor, limit: page.limit ?? options?.limit }),
      options,
    );
  }

  get(id: string, options?: { signal?: AbortSignal }): Promise<Customer> {
    return this.client.get<Customer>(`/v1/customers/${id}`, undefined, options);
  }

  update(id: string, input: Partial<CreateCustomerInput>, options?: { idempotencyKey?: string; signal?: AbortSignal }): Promise<Customer> {
    return this.client.patch<Customer>(`/v1/customers/${id}`, input, options);
  }

  /** Remove das listagens sem apagar o histórico de pedidos. */
  archive(id: string, options?: { idempotencyKey?: string; signal?: AbortSignal }): Promise<void> {
    return this.client.post<void>(`/v1/customers/${id}/archive`, undefined, options);
  }

  /** Revoga todas as sessões ativas do portal do cliente. */
  revokePortalSessions(id: string, options?: { idempotencyKey?: string; signal?: AbortSignal }): Promise<void> {
    return this.client.post<void>(`/v1/customers/${id}/portal-sessions/revoke`, undefined, options);
  }

  /** Abre uma sessão do portal (link único de curta duração) para o cliente gerenciar assinaturas. */
  createPortalSession(input: { customerId: string } & Record<string, unknown>, options?: { idempotencyKey?: string; signal?: AbortSignal }): Promise<Record<string, unknown>> {
    return this.client.post('/v1/customer-portal-sessions', input, options);
  }
}
