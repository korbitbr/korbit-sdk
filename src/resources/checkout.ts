import type { HttpClient } from '../http-client.js';

export interface CreateCheckoutSessionInput {
  offerId: string;
  [key: string]: unknown;
}

export interface CheckoutSession {
  [key: string]: unknown;
}

export interface CheckoutLink {
  publicCode: string;
  [key: string]: unknown;
}

export class CheckoutResource {
  readonly #client: HttpClient;

  constructor(client: HttpClient) {
    this.#client = client;
  }

  /**
   * Cria uma sessão de checkout (30 min) com comprador pré-preenchido —
   * o mesmo motor do link público. O token é efêmero e de uso único.
   */
  createSession(input: CreateCheckoutSessionInput, options?: { idempotencyKey?: string; signal?: AbortSignal }): Promise<CheckoutSession> {
    return this.#client.post<CheckoutSession>('/v1/checkout-sessions', input, options);
  }

  /** Consulta um link de pagamento pelo código público (korbit.com.br/o/{publicCode}). */
  getLink(publicCode: string, options?: { signal?: AbortSignal }): Promise<CheckoutLink> {
    return this.#client.get<CheckoutLink>(`/v1/checkout-links/${publicCode}`, undefined, options);
  }
}
