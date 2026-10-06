/** Verificação nativa de webhooks (padrão Svix) — sem dependências. */
import { createHmac, timingSafeEqual } from 'node:crypto';

export interface WebhookHeaders {
  'svix-id': string;
  'svix-timestamp': string;
  'svix-signature': string;
}

export interface WebhookVerification {
  /** 0 = sem tolerância adicional (além da janela padrão de 5 minutos). */
  toleranceSeconds: number;
}

const DEFAULT_TOLERANCE_SECONDS = 5 * 60;

/** Erro de verificação — NUNCA processe o evento quando isso for lançado. */
export class WebhookVerificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WebhookVerificationError';
  }
}

/**
 * Verifica a assinatura Svix sobre o corpo BRUTO da requisição.
 * Compare em tempo constante e rejeite timestamps fora da tolerância (anti-replay).
 */
export function verifyWebhook<P = unknown>(
  payload: string,
  headers: WebhookHeaders,
  secret: string,
  options: Partial<WebhookVerification> = {},
): P {
  const toleranceSeconds = options.toleranceSeconds ?? DEFAULT_TOLERANCE_SECONDS;

  if (typeof payload !== 'string' || payload.length === 0) {
    throw new WebhookVerificationError('payload vazio — use o corpo bruto da requisição');
  }
  const secretPart = secret.startsWith('whsec_') ? secret.slice('whsec_'.length) : secret;
  let key: Buffer;
  try {
    key = Buffer.from(secretPart, 'base64');
  } catch {
    throw new WebhookVerificationError('secret de webhook inválido');
  }

  const id = headers['svix-id'];
  const timestamp = headers['svix-timestamp'];
  const signatures = headers['svix-signature'];
  if (!id || !timestamp || !signatures) {
    throw new WebhookVerificationError('cabeçalhos svix-* ausentes');
  }

  const timestampSeconds = Number(timestamp);
  if (!Number.isInteger(timestampSeconds)) {
    throw new WebhookVerificationError('svix-timestamp inválido');
  }
  const nowSeconds = Math.floor(Date.now() / 1_000);
  if (Math.abs(nowSeconds - timestampSeconds) > toleranceSeconds) {
    throw new WebhookVerificationError('timestamp fora da tolerância (possível replay)');
  }

  const signedContent = `${id}.${timestamp}.${payload}`;
  const expected = createHmac('sha256', key).update(signedContent, 'utf8').digest('base64');
  const candidates = signatures.split(' ').filter((candidate) => candidate.length > 0);
  const match = candidates.some((candidate) => {
    const a = Buffer.from(candidate);
    const b = Buffer.from(expected);
    return a.length === b.length && timingSafeEqual(a, b);
  });
  if (!match) {
    throw new WebhookVerificationError('assinatura inválida');
  }

  return JSON.parse(payload) as P;
}

/** Verificador vinculado a um segredo de endpoint — reuso em múltiplas entregas. */
export class WebhookVerifier {
  readonly #secret: string;

  constructor(secret: string) {
    this.#secret = secret;
  }

  verify<P = unknown>(payload: string, headers: WebhookHeaders): P {
    return verifyWebhook<P>(payload, headers, this.#secret);
  }
}
