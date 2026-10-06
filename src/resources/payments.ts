import type { HttpClient } from '../http-client.js';
import type { PaymentIntent, CreatePaymentIntentInput } from '../types/payments.js';

export class PaymentsResource {
  readonly #client: HttpClient;

  constructor(client: HttpClient) {
    this.#client = client;
  }

  /**
   * Cria uma cobrança PIX ou cartão. A resposta vem em `REQUIRES_ACTION` com
   * os dados para o comprador pagar (`pix.copyAndPaste` ou `cardAction`).
   * O estado final chega por webhook — confirme por `get()` antes de liberar o produto.
   */
  create(input: CreatePaymentIntentInput, options?: { idempotencyKey?: string; signal?: AbortSignal }): Promise<PaymentIntent> {
    return this.#client.post<PaymentIntent>('/v1/payment-intents', input, options);
  }

  /** Estado autoritativo da cobrança. */
  get(id: string, options?: { signal?: AbortSignal }): Promise<PaymentIntent> {
    return this.#client.get<PaymentIntent>(`/v1/payment-intents/${id}`, undefined, options);
  }
}
