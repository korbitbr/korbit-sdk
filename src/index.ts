/**
 * SDK oficial da Korbit para Node.js.
 *
 * ```ts
 * import { Korbit } from '@korbitbr/sdk';
 * const korbit = new Korbit({ apiKey: 'kbt_live_...' });
 * await korbit.payments.create({ amount: 14990, currency: 'BRL', paymentMethod: 'PIX' });
 * ```
 *
 * O ambiente (produção/sandbox) é derivado do prefixo da chave.
 * Toda mutação envia Idempotency-Key automaticamente; 429/5xx têm retry com backoff.
 */
import { HttpClient, type KorbitOptions } from './http-client.js';
import { ActivityResource } from './resources/activity.js';
import { AdvancesResource } from './resources/advances.js';
import { ApiKeysResource } from './resources/api-keys.js';
import { BalanceResource } from './resources/balance.js';
import { CheckoutResource } from './resources/checkout.js';
import { CustomersResource } from './resources/customers.js';
import { FundsReleasesResource } from './resources/funds-releases.js';
import { OrdersResource } from './resources/orders.js';
import { PayoutsResource } from './resources/payouts.js';
import { PaymentsResource } from './resources/payments.js';
import { CatalogResource } from './resources/catalog.js';
import { RefundsResource } from './resources/refunds.js';
import { SandboxResource } from './resources/sandbox.js';
import { SubscriptionsResource } from './resources/subscriptions.js';
import { WebhooksResource } from './resources/webhooks.js';
import { WebhookVerifier, type WebhookHeaders } from './webhooks/verify.js';

export * from './errors.js';
export { NetworkError } from './http-client.js';
export { KorbitApiError } from './errors.js';

const KEY_PATTERN = /^kbt_(live|test)_[A-Za-z0-9]+_[A-Za-z0-9]+$/;

export interface KorbitConstructorOptions extends Omit<KorbitOptions, 'baseUrl'> {
  /** Sobrescreve a base URL derivada da chave (ex.: proxies em desenvolvimento). */
  baseUrl?: string;
}

export class Korbit {
  readonly #client: HttpClient;
  readonly environment: 'live' | 'test';

  readonly payments: PaymentsResource;
  readonly customers: CustomersResource;
  readonly orders: OrdersResource;
  readonly catalog: CatalogResource;
  readonly checkout: CheckoutResource;
  readonly subscriptions: SubscriptionsResource;
  readonly balance: BalanceResource;
  readonly fundsReleases: FundsReleasesResource;
  readonly payouts: PayoutsResource;
  readonly refunds: RefundsResource;
  readonly advances: AdvancesResource;
  readonly webhooks: WebhooksResource;
  readonly apiKeys: ApiKeysResource;
  readonly activity: ActivityResource;
  readonly sandbox: SandboxResource;

  constructor(options: KorbitConstructorOptions) {
    const apiKey = options.apiKey?.trim() ?? '';
    const match = KEY_PATTERN.exec(apiKey);
    if (!match) {
      throw new Error(
        'apiKey ausente ou malformada. Use uma chave de API da Korbit no formato ' +
          'kbt_live_<publicId>_<secret> (produção) ou kbt_test_<publicId>_<secret> (sandbox). ' +
          'Gere a chave no painel Korbit em Integrações → Chaves de API.',
      );
    }
    this.environment = match[1] as 'live' | 'test';
    const baseUrl =
      options.baseUrl?.replace(/\/+$/, '') ??
      (this.environment === 'live'
        ? 'https://api.korbit.com.br'
        : 'https://api-test.korbit.com.br');
    this.#client = new HttpClient({ ...options, apiKey, baseUrl });

    this.payments = new PaymentsResource(this.#client);
    this.customers = new CustomersResource(this.#client);
    this.orders = new OrdersResource(this.#client);
    this.catalog = new CatalogResource(this.#client);
    this.checkout = new CheckoutResource(this.#client);
    this.subscriptions = new SubscriptionsResource(this.#client);
    this.balance = new BalanceResource(this.#client);
    this.fundsReleases = new FundsReleasesResource(this.#client);
    this.payouts = new PayoutsResource(this.#client);
    this.refunds = new RefundsResource(this.#client);
    this.advances = new AdvancesResource(this.#client);
    this.webhooks = new WebhooksResource(this.#client);
    this.apiKeys = new ApiKeysResource(this.#client);
    this.activity = new ActivityResource(this.#client);
    this.sandbox = new SandboxResource(this.#client, this.environment);
  }

  /** Escape hatch: requisição crua para qualquer endpoint (ex.: export.csv streaming). */
  request<T = unknown>(
    method: string,
    path: string,
    body?: unknown,
    options?: { query?: Record<string, unknown>; idempotencyKey?: string; signal?: AbortSignal },
  ) {
    return this.#client.request<T>(method, path, body, options);
  }
}

/** Instância de verificação de webhooks vinculada a um segredo de endpoint. */
export class KorbitWebhooks {
  readonly #verifier: WebhookVerifier;

  constructor(endpointSecret: string) {
    this.#verifier = new WebhookVerifier(endpointSecret);
  }

  verify<P = unknown>(payload: string, headers: WebhookHeaders): P {
    return this.#verifier.verify<P>(payload, headers);
  }
}
