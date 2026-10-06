import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { test } from 'node:test';
import { verifyWebhook, WebhookVerificationError } from '../src/webhooks/verify.js';

const SECRET = 'whsec_' + Buffer.from('test-endpoint-secret-0123456789').toString('base64');
const PAYLOAD = JSON.stringify({
  type: 'payment.succeeded.v1',
  timestamp: '2026-10-05T12:00:00.000Z',
  data: { id: 'pi_1', amount_minor: 14990 },
});

function sign(id: string, timestamp: string, body: string, secretBase64: string): string {
  return createHmac('sha256', Buffer.from(secretBase64, 'base64'))
    .update(`${id}.${timestamp}.${body}`, 'utf8')
    .digest('base64');
}

function headersFor(id: string, timestampSeconds: number, body: string, secretBase64?: string) {
  return {
    'svix-id': id,
    'svix-timestamp': String(timestampSeconds),
    'svix-signature': sign(id, String(timestampSeconds), body, secretBase64 ?? SECRET.split('_')[1]!),
  };
}

test('assinatura válida verifica e devolve o evento parseado', () => {
  const now = Math.floor(Date.now() / 1_000);
  const event = verifyWebhook<{ type: string }>(PAYLOAD, headersFor('msg_1', now, PAYLOAD), SECRET);
  assert.equal(event.type, 'payment.succeeded.v1');
});

test('corpo adulterado é rejeitado', () => {
  const now = Math.floor(Date.now() / 1_000);
  const tampered = PAYLOAD.replace('14990', '99999');
  // Assinatura válida sobre o corpo ORIGINAL — o corpo adulterado não bate.
  const headers = headersFor('msg_1', now, PAYLOAD);
  assert.throws(() => verifyWebhook(tampered, headers, SECRET), WebhookVerificationError);
});

test('timestamp fora da tolerância é rejeitado (anti-replay)', () => {
  const old = Math.floor(Date.now() / 1_000) - 15 * 60;
  assert.throws(
    () => verifyWebhook(PAYLOAD, headersFor('msg_1', old, PAYLOAD), SECRET),
    /tolerância/,
  );
});

test('tolerância customizada é honrada', () => {
  const old = Math.floor(Date.now() / 1_000) - 15 * 60;
  const event = verifyWebhook<{ type: string }>(PAYLOAD, headersFor('msg_1', old, PAYLOAD), SECRET, {
    toleranceSeconds: 3600,
  });
  assert.equal(event.type, 'payment.succeeded.v1');
});

test('segredo errado é rejeitado', () => {
  const now = Math.floor(Date.now() / 1_000);
  const wrongSecret = Buffer.from('outro-seguro-9876543210').toString('base64');
  assert.throws(
    () => verifyWebhook(PAYLOAD, headersFor('msg_1', now, PAYLOAD, wrongSecret), SECRET),
    /assinatura inválida/,
  );
});

test('múltiplas assinaturas no header: uma válida basta', () => {
  const now = Math.floor(Date.now() / 1_000);
  const valid = sign('msg_1', String(now), PAYLOAD, SECRET.split('_')[1]!);
  const headers = {
    'svix-id': 'msg_1',
    'svix-timestamp': String(now),
    'svix-signature': `deadbeef-base64 ${valid}`,
  };
  const event = verifyWebhook<{ type: string }>(PAYLOAD, headers, SECRET);
  assert.equal(event.type, 'payment.succeeded.v1');
});

test('seguro em tempo constante: segredo com prefixo whsec_ é tratado', () => {
  const now = Math.floor(Date.now() / 1_000);
  const rawSecret = Buffer.from('test-endpoint-secret-0123456789').toString('base64');
  const event = verifyWebhook<{ type: string }>(
    PAYLOAD,
    headersFor('msg_1', now, PAYLOAD),
    `whsec_${rawSecret}`,
  );
  assert.equal(event.type, 'payment.succeeded.v1');
});

test('cabeçalhos ausentes são rejeitados', () => {
  const now = Math.floor(Date.now() / 1_000);
  const partial = headersFor('msg_1', now, PAYLOAD) as Record<string, string>;
  delete partial['svix-signature'];
  assert.throws(
    () => verifyWebhook(PAYLOAD, partial as never, SECRET),
    /cabeçalhos svix-\* ausentes/,
  );
});
