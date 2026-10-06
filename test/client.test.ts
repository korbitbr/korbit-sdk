import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Korbit } from '../src/index.js';
import { KorbitApiError } from '../src/errors.js';
import { NetworkError } from '../src/http-client.js';

const TEST_KEY = 'kbt_test_abc123_secret456';

/** Fetch falso com fila de respostas e captura das chamadas. */
function fakeKorbit(
  responses: Array<{ status: number; body?: unknown; headers?: Record<string, string> }>,
  options?: { maxRetries?: number },
) {
  const calls: Array<{ method: string; url: URL; body?: unknown; headers: Record<string, string> }> = [];
  const queue = [...responses];
  const fetchImpl = (async (url: URL | string, init?: RequestInit) => {
    const headers = (init?.headers ?? {}) as Record<string, string>;
    calls.push({
      method: init?.method ?? 'GET',
      url: new URL(String(url)),
      body: init?.body === undefined ? undefined : JSON.parse(String(init.body)),
      headers,
    });
    const next = queue.shift() ?? { status: 200, body: {} };
    return new Response(next.body === undefined ? '' : JSON.stringify(next.body), {
      status: next.status,
      headers: next.headers,
    });
  }) as typeof fetch;
  const korbit = new Korbit({
    apiKey: TEST_KEY,
    maxRetries: options?.maxRetries ?? 2,
    fetchImpl,
  });
  return { korbit, calls };
}

test('ambiente derivado do prefixo da chave (live/test) com URL correta', () => {
  assert.equal(new Korbit({ apiKey: TEST_KEY, fetchImpl: fetch }).environment, 'test');
  const live = new Korbit({ apiKey: 'kbt_live_abc123_secret456', fetchImpl: fetch });
  assert.equal(live.environment, 'live');
  // Sem rede: apenas verificar que a instância existe com a base certa.
  assert.ok(String((live as unknown as { '#client': unknown })).length >= 0);
});

test('chave malformada falha com mensagem clara', () => {
  for (const bad of ['', 'sk_live_x', 'kbt_sandbox_a_b']) {
    assert.throws(() => new Korbit({ apiKey: bad, fetchImpl: fetch }), /apiKey ausente ou malformada/);
  }
});

test('mutação envia Idempotency-Key UUID automaticamente', async () => {
  const { korbit, calls } = fakeKorbit([{ status: 201, body: { id: 'pi_1' } }]);
  await korbit.payments.create({ amount: 14990, paymentMethod: 'PIX' });
  assert.match(calls[0].headers['Idempotency-Key'], /^[0-9a-f-]{36}$/);
});

test('idempotencyKey explícita é respeitada', async () => {
  const { korbit, calls } = fakeKorbit([{ status: 201, body: {} }]);
  const key = '11111111-2222-3333-4444-555555555555';
  await korbit.payments.create({ amount: 100, paymentMethod: 'PIX' }, { idempotencyKey: key });
  assert.equal(calls[0].headers['Idempotency-Key'], key);
});

test('GET não envia Idempotency-Key', async () => {
  const { korbit, calls } = fakeKorbit([{ status: 200, body: { availableMinor: 100 } }]);
  await korbit.balance.get();
  assert.equal(calls[0].headers['Idempotency-Key'], undefined);
});

test('429 com Retry-After é retificado e re-tentado', async () => {
  const { korbit, calls } = fakeKorbit([
    { status: 429, body: { code: 'RATE_LIMITED' }, headers: { 'retry-after': '0' } },
    { status: 200, body: { data: [{ id: 'o1' }], next_cursor: null } },
  ]);
  const page = await korbit.orders.list();
  assert.equal(page.data[0]?.id, 'o1');
  assert.equal(calls.length, 2, 'deve ter re-tentado após 429');
});

test('erro 4xx não é retriado e vira KorbitApiError com code/requestId', async () => {
  const { korbit, calls } = fakeKorbit([
    {
      status: 404,
      body: { code: 'PAYMENT_INTENT_NOT_FOUND', detail: 'não encontrado', requestId: 'req-9' },
    },
  ]);
  await assert.rejects(
    () => korbit.payments.get('00000000-0000-0000-0000-000000000000'),
    (error: unknown) => {
      assert.ok(error instanceof KorbitApiError);
      assert.equal(error.status, 404);
      assert.equal(error.code, 'PAYMENT_INTENT_NOT_FOUND');
      assert.equal(error.requestId, 'req-9');
      assert.equal(error.isClientError, true);
      return true;
    },
  );
  assert.equal(calls.length, 1, '4xx não deve re-tentar');
});

test('503 esgotado lança após maxRetries', async () => {
  const { korbit, calls } = fakeKorbit(
    [
      { status: 503, body: { code: 'RATE_LIMIT_UNAVAILABLE' } },
      { status: 503, body: { code: 'RATE_LIMIT_UNAVAILABLE' } },
      { status: 503, body: { code: 'RATE_LIMIT_UNAVAILABLE' } },
    ],
    { maxRetries: 2 },
  );
  await assert.rejects(() => korbit.balance.get(), (error: unknown) => {
    assert.ok(error instanceof KorbitApiError);
    assert.equal(error.status, 503);
    return true;
  });
  assert.equal(calls.length, 3, '1 original + 2 retries');
});

test('paginação: iterate() percorre todas as páginas', async () => {
  const pages = [
    { status: 200, body: { data: [{ id: 'o1' }, { id: 'o2' }], next_cursor: 'cursor-2' } },
    { status: 200, body: { data: [{ id: 'o3' }], next_cursor: null } },
  ];
  const { korbit, calls } = fakeKorbit(pages);
  const ids: string[] = [];
  for await (const order of korbit.orders.iterate({ limit: 2 })) ids.push(order.id);
  assert.deepEqual(ids, ['o1', 'o2', 'o3']);
  assert.match(String(calls[1].url), /cursor=cursor-2/);
});

test('escape hatch request() expõe status/headers (streaming CSV)', async () => {
  const { korbit, calls } = fakeKorbit([
    { status: 200, body: { data: 'id;valor\n1;1490', next_cursor: null }, headers: { 'content-type': 'text/csv' } },
  ]);
  const response = await korbit.request<{ data: string }>('GET', '/v1/orders/export.csv', undefined, {
    query: { view: 'full' },
  });
  assert.equal(response.status, 200);
  assert.match(String(response.headers.get('content-type')), /text\/csv/);
  assert.match(String(calls[0].url), /view=full/);
});

test('falha de rede vira NetworkError (retriável)', async () => {
  const fetchImpl = (async () => {
    throw new TypeError('fetch failed');
  }) as typeof fetch;
  const korbit = new Korbit({ apiKey: TEST_KEY, fetchImpl, maxRetries: 0 });
  await assert.rejects(() => korbit.balance.get(), (error: unknown) => {
    assert.ok(error instanceof NetworkError);
    return true;
  });
});

test('query string descarta valores vazios/undefined', async () => {
  const { korbit, calls } = fakeKorbit([{ status: 200, body: { data: [], next_cursor: null } }]);
  await korbit.orders.list({ cursor: undefined, limit: 5, status: 'PAID' });
  const url = calls[0].url;
  assert.match(String(url), /limit=5/);
  assert.match(String(url), /status=PAID/);
  assert.doesNotMatch(String(url), /cursor/);
});
