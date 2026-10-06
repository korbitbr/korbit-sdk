import type { HttpClient } from '../http-client.js';
import type { Cents } from './base.js';

export interface Balance {
  availableMinor: Cents;
  pendingMinor?: Cents;
  reservedMinor?: Cents;
  [key: string]: unknown;
}

export class BalanceResource {
  readonly #client: HttpClient;

  constructor(client: HttpClient) {
    this.#client = client;
  }

  /** Saldo da conta: disponível para saque, a liberar e reservado. */
  get(options?: { signal?: AbortSignal }): Promise<Balance> {
    return this.#client.get<Balance>('/v1/balance', undefined, options);
  }

  /** Composição detalhada por componente. */
  breakdown(options?: { signal?: AbortSignal }): Promise<Record<string, unknown>> {
    return this.#client.get('/v1/balance/breakdown', undefined, options);
  }
}
