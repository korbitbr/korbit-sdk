import type { HttpClient } from '../http-client.js';
import { fetchCursorPage, ResourceBase, type CursorPage } from './base.js';

export const WEBHOOK_EVENT_TYPES = [
  'payment.created.v1',
  'payment.requires_action.v1',
  'payment.succeeded.v1',
  'payment.failed.v1',
  'refund.requested.v1',
  'refund.updated.v1',
  'refund.succeeded.v1',
  'payout.requested.v1',
  'payout.updated.v1',
  'dispute.opened.v1',
  'dispute.updated.v1',
  'merchant.kyc.updated.v1',
  'merchant.status.updated.v1',
  'subscription.created.v1',
  'subscription.activated.v1',
  'subscription.renewed.v1',
  'subscription.payment_failed.v1',
  'subscription.canceled.v1',
  'subscription.expired.v1',
  'subscription.plan_change_scheduled.v1',
] as const;

export type WebhookEventType = (typeof WEBHOOK_EVENT_TYPES)[number];

export interface CreateWebhookSubscriptionInput {
  url: string;
  eventTypes: WebhookEventType[];
}

export interface WebhookSubscription {
  id: string;
  url: string;
  eventTypes: WebhookEventType[];
  environment?: 'live' | 'test';
  status: 'ACTIVE' | 'DISABLED' | 'ERROR' | 'PENDING';
  createdAt?: string;
  [key: string]: unknown;
}

export class WebhooksResource extends ResourceBase {
  constructor(client: HttpClient) {
    super(client);
  }

  /** Registra um endpoint HTTPS para receber os tipos de evento escolhidos. */
  create(input: CreateWebhookSubscriptionInput, options?: { idempotencyKey?: string; signal?: AbortSignal }): Promise<WebhookSubscription> {
    return this.client.post<WebhookSubscription>('/v1/webhook-subscriptions', input, options);
  }

  /** Monitore o estado `ERROR` — entregas esgotadas param até recuperação. */
  list(options?: { signal?: AbortSignal }): Promise<CursorPage<WebhookSubscription>> {
    return fetchCursorPage<WebhookSubscription>(this.client, '/v1/webhook-subscriptions', undefined, options);
  }

  disable(id: string, options?: { idempotencyKey?: string; signal?: AbortSignal }): Promise<void> {
    return this.client.post<void>(`/v1/webhook-subscriptions/${id}/disable`, undefined, options);
  }
}
