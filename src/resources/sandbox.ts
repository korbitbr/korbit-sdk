import type { HttpClient } from '../http-client.js';

export class SandboxResource {
  readonly #client: HttpClient;
  readonly #environment: 'live' | 'test';

  constructor(client: HttpClient, environment: 'live' | 'test') {
    this.#client = client;
    this.#environment = environment;
  }

  /** Disponível apenas com chave `kbt_test_`. */
  #assertSandbox(): void {
    if (this.#environment !== 'test') {
      throw new Error(
        'Métodos de simulação só existem no sandbox: use uma chave kbt_test_. ' +
          'Nada na produção é simulado.',
      );
    }
  }

  /** Força o desfecho de um payment intent de teste: SUCCEEDED, FAILED ou EXPIRED. */
  async simulatePaymentIntent(
    id: string,
    input: { outcome: 'SUCCEEDED' | 'FAILED' | 'EXPIRED' },
    options?: { idempotencyKey?: string; signal?: AbortSignal },
  ): Promise<Record<string, unknown>> {
    this.#assertSandbox();
    return this.#client.post(`/v1/sandbox/payment-intents/${id}/simulate`, input, options);
  }

  /** Cria um caso de refund/disputa de teste para exercitar prazos e respostas. */
  async simulateCase(
    id: string,
    input: Record<string, unknown>,
    options?: { idempotencyKey?: string; signal?: AbortSignal },
  ): Promise<Record<string, unknown>> {
    this.#assertSandbox();
    return this.#client.post(`/v1/sandbox/payment-intents/${id}/cases/simulate`, input, options);
  }

  /** Entrega ao seu endpoint a mesma mensagem assinada da produção. */
  async simulateWebhook(
    id: string,
    input: Record<string, unknown>,
    options?: { idempotencyKey?: string; signal?: AbortSignal },
  ): Promise<Record<string, unknown>> {
    this.#assertSandbox();
    return this.#client.post(`/v1/sandbox/payment-intents/${id}/webhooks/simulate`, input, options);
  }

  /** Confirma o pagamento PIX de um pedido de teste (cenário pix.paid do simulador). */
  async simulateOrderPixPayment(
    orderId: string,
    input: Record<string, unknown> = {},
    options?: { idempotencyKey?: string; signal?: AbortSignal },
  ): Promise<Record<string, unknown>> {
    this.#assertSandbox();
    return this.#client.post(`/v1/orders/${orderId}/simulate-pix-payment`, input, options);
  }

  /** Avança o ciclo de uma assinatura de teste (fatura + cobrança simulada). */
  async simulateSubscription(
    id: string,
    input: Record<string, unknown> = {},
    options?: { idempotencyKey?: string; signal?: AbortSignal },
  ): Promise<Record<string, unknown>> {
    this.#assertSandbox();
    return this.#client.post(`/v1/test/subscriptions/${id}/simulate`, input, options);
  }
}
