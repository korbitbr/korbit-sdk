import type { HttpClient } from '../http-client.js';
import { fetchCursorPage, ResourceBase, type CursorPage, type PageOptions } from './base.js';
import type { Cents } from './base.js';

export interface CreateRefundInput {
  paymentIntentId: string;
  /** Valor a devolver em centavos (≤ saldo restante do pagamento). */
  amountMinor: Cents;
  reason?: string;
}

export interface RefundCase {
  id: string;
  status?: string;
  reviewDeadlineAt?: string | null;
  [key: string]: unknown;
}

export class RefundsResource extends ResourceBase {
  readonly cases: RefundCasesGroup;

  constructor(client: HttpClient) {
    super(client);
    this.cases = new RefundCasesGroup(client);
  }

  /** Cria a devolução (total/parcial). O valor é reservado antes da execução. */
  create(input: CreateRefundInput, options?: { idempotencyKey?: string; signal?: AbortSignal }): Promise<RefundCase> {
    return this.client.post<RefundCase>('/v1/refunds', input, options);
  }
}

export class RefundCasesGroup {
  readonly #client: HttpClient;

  constructor(client: HttpClient) {
    this.#client = client;
  }

  list(options?: PageOptions & { signal?: AbortSignal }): Promise<CursorPage<RefundCase>> {
    return fetchCursorPage<RefundCase>(
      this.#client,
      '/v1/refund-cases',
      ResourceBase.query(options ?? {}),
      options,
    );
  }

  get(caseId: string, options?: { signal?: AbortSignal }): Promise<RefundCase> {
    return this.#client.get<RefundCase>(`/v1/refund-cases/${caseId}`, undefined, options);
  }

  /** Concorda com a devolução solicitada pelo comprador. */
  approve(caseId: string, options?: { idempotencyKey?: string; signal?: AbortSignal }): Promise<RefundCase> {
    return this.#client.post<RefundCase>(`/v1/refund-cases/${caseId}/merchant-approve`, undefined, options);
  }

  /** Contesta com sua argumentação — siga o prazo (`reviewDeadlineAt`). */
  contest(caseId: string, input: Record<string, unknown>, options?: { idempotencyKey?: string; signal?: AbortSignal }): Promise<RefundCase> {
    return this.#client.post<RefundCase>(`/v1/refund-cases/${caseId}/merchant-contest`, input, options);
  }

  /** Envia informações/evidências adicionais solicitadas na análise. */
  respond(caseId: string, input: Record<string, unknown>, options?: { idempotencyKey?: string; signal?: AbortSignal }): Promise<RefundCase> {
    return this.#client.post<RefundCase>(`/v1/refund-cases/${caseId}/merchant-responses`, input, options);
  }
}
