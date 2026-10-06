import type { HttpClient } from '../http-client.js';
import { fetchCursorPage, ResourceBase, type CursorPage, type PageOptions } from './base.js';
import type { Cents } from './base.js';

export interface CreatePayoutRequestInput {
  /** Valor a sacar em centavos (mínimo e saldo disponível são validados). */
  amountMinor: Cents;
  currency?: 'BRL';
  beneficiaryId: string;
}

export interface PayoutRequest {
  id: string;
  status: 'PENDING_REVIEW' | 'APPROVED' | 'EXECUTED' | 'RECONCILIADO' | 'REJECTED' | 'FAILED' | string;
  amountMinor?: Cents;
  beneficiaryId?: string;
  [key: string]: unknown;
}

export interface CreatePayoutBeneficiaryInput {
  /** A chave PIX (CPF, CNPJ, e-mail, telefone ou EVP). */
  pixKey: string;
  pixKeyType: 'CPF' | 'CNPJ' | 'EMAIL' | 'PHONE' | 'EVP';
}

export interface PayoutBeneficiary {
  id: string;
  status?: string;
  pixKeyMasked?: string;
  isPrimary?: boolean;
  [key: string]: unknown;
}

export class PayoutsResource extends ResourceBase {
  readonly beneficiaries: BeneficiariesGroup;

  constructor(client: HttpClient) {
    super(client);
    this.beneficiaries = new BeneficiariesGroup(client);
  }

  /** Solicita a transferência do saldo disponível — o valor é reservado transacionalmente. */
  request(input: CreatePayoutRequestInput, options?: { idempotencyKey?: string; signal?: AbortSignal }): Promise<PayoutRequest> {
    return this.client.post<PayoutRequest>('/v1/payout-requests', input, options);
  }

  list(options?: PageOptions & { signal?: AbortSignal }): Promise<CursorPage<PayoutRequest>> {
    return fetchCursorPage<PayoutRequest>(this.client, '/v1/payout-requests', ResourceBase.query(options ?? {}), options);
  }

  get(id: string, options?: { signal?: AbortSignal }): Promise<PayoutRequest> {
    return this.client.get<PayoutRequest>(`/v1/payout-requests/${id}`, undefined, options);
  }
}

export class BeneficiariesGroup {
  readonly #client: HttpClient;

  constructor(client: HttpClient) {
    this.#client = client;
  }

  /** Cadastra a chave PIX de destino (armazenada criptografada; sempre mascarada nas respostas). */
  create(input: CreatePayoutBeneficiaryInput, options?: { idempotencyKey?: string; signal?: AbortSignal }): Promise<PayoutBeneficiary> {
    return this.#client.post<PayoutBeneficiary>('/v1/payout-beneficiaries', input, options);
  }

  list(options?: PageOptions & { signal?: AbortSignal }): Promise<CursorPage<PayoutBeneficiary>> {
    return fetchCursorPage<PayoutBeneficiary>(
      this.#client,
      '/v1/payout-beneficiaries',
      ResourceBase.query(options ?? {}),
      options,
    );
  }

  setPrimary(id: string, options?: { idempotencyKey?: string; signal?: AbortSignal }): Promise<PayoutBeneficiary> {
    return this.#client.patch<PayoutBeneficiary>(`/v1/payout-beneficiaries/${id}/primary`, undefined, options);
  }

  disable(id: string, options?: { idempotencyKey?: string; signal?: AbortSignal }): Promise<void> {
    return this.#client.delete<void>(`/v1/payout-beneficiaries/${id}`, options);
  }
}
