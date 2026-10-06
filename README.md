# @korbitbr/sdk

SDK oficial da Korbit para Node.js: pagamentos PIX e cartão, catálogo, assinaturas, saldo, saques e webhooks — **zero dependências de runtime**, TypeScript nativo, idempotência automática e retries com backoff.

```bash
npm install @korbitbr/sdk
```

## Quickstart

```ts
import { Korbit } from '@korbitbr/sdk';

const korbit = new Korbit({ apiKey: process.env.KORBIT_API_KEY }); // kbt_live_… ou kbt_test_…

// Primeira cobrança PIX: QR/copia-e-cola em REQUIRES_ACTION
const payment = await korbit.payments.create({
  amount: 14990, // centavos (BRL): R$ 149,90
  paymentMethod: 'PIX',
  externalReference: 'pedido-1042',
});

console.log(payment.status);            // REQUIRES_ACTION
console.log(payment.pix?.copyAndPaste); // código PIX para o comprador

// O estado final chega por webhook — confirme por API antes de liberar o produto:
const intent = await korbit.payments.get(payment.id);
if (intent.status === 'SUCCEEDED') { /* liberar acesso */ }
```

O ambiente é **derivado da chave**: `kbt_test_…` usa o sandbox (`api-test.korbit.com.br`), `kbt_live_…` usa produção (`api.korbit.com.br`).

## O que o SDK faz por você

| | |
| --- | --- |
| **Idempotência automática** | toda mutação envia `Idempotency-Key` (UUID) — retries nunca cobram duas vezes |
| **Retry com backoff** | `429`/`503`/falha de rede re-tentados com backoff exponencial, respeitando `Retry-After` (`maxRetries` configurável, padrão 2) |
| **Erros tipados** | `KorbitApiError` com `status`, `code`, `requestId` e helpers (`isRateLimited`, `isTemporary`, `isClientError`) |
| **Ambiente pela chave** | sem parâmetro de ambiente; sandbox e produção por prefixo `kbt_` |
| **Paginação com cursor** | `iterate()` async generator em todas as listagens |
| **Verificação de webhooks nativa** | `verifyWebhook()` HMAC + timing-safe + tolerância anti-replay, sem dependências |

## Recursos

```ts
korbit.payments.create({ amount, paymentMethod, … })        // PIX | CARD
korbit.payments.get(id)

korbit.customers.create({ name, email, … })
korbit.customers.list({ search, cursor, limit })            // + .iterate()
korbit.customers.get(id) / .update(id, patch) / .archive(id)
korbit.customers.createPortalSession({ customerId })        // portal self-service
korbit.customers.revokePortalSessions(id)

korbit.orders.list({ status })  / .get(id) / .counts(query)

korbit.catalog.products.create({ name }) / .list() / .get() / .update() / .archive()
korbit.catalog.products.createPrice(productId, { amountMinor: 14990 })
korbit.catalog.products.createOffer(productId, { priceId, paymentMethods: ['PIX','CARD'] })
korbit.catalog.products.createImageUpload / .completeImageUpload    // upload em 3 passos
korbit.catalog.offers.get / .revise / .publish / .archive

korbit.checkout.createSession({ offerId, … })               // sessão 30 min
korbit.checkout.getLink(publicCode)

korbit.subscriptions.list() / .get() / .listInvoices(id)
korbit.subscriptions.cancel(id)                             // imediato

korbit.balance.get() / .breakdown()
korbit.fundsReleases.list() / .calendar() / .summary()

korbit.payouts.request({ amountMinor, beneficiaryId })      // reserva transacional
korbit.payouts.list() / .get(id)
korbit.payouts.beneficiaries.create({ pixKey, pixKeyType })
korbit.payouts.beneficiaries.list() / .setPrimary(id) / .disable(id)

korbit.refunds.create({ paymentIntentId, amountMinor })
korbit.refunds.cases.list() / .get(caseId)
korbit.refunds.cases.approve(caseId) / .contest(caseId, input) / .respond(caseId, input)

korbit.advances.listReceivables() / .eligibility() / .quote() / .create() / .list() / .get()

korbit.webhooks.create({ url, eventTypes }) / .list() / .disable(id)
korbit.apiKeys.create({ name, scopes }) / .list() / .rotate(id) / .revoke(id)
korbit.activity.list()

// Sandbox apenas (chave kbt_test_):
korbit.sandbox.simulatePaymentIntent(id, { outcome: 'SUCCEEDED' })
korbit.sandbox.simulateCase(id, input) / .simulateWebhook(id, input)
korbit.sandbox.simulateSubscription(id) / .simulateOrderPixPayment(orderId)
```

### Listagens: paginação automática

```ts
// Uma página
const page = await korbit.orders.list({ status: 'PAID', limit: 50 });
page.data; page.nextCursor;

// Todas as páginas (async generator)
for await (const order of korbit.orders.iterate({ status: 'PAID' })) {
  console.log(order.id, order.amount);
}
```

## Webhooks

```ts
import { verifyWebhook } from '@korbitbr/sdk';

// payload = corpo BRUTO da requisição (string) — nunca o objeto parseado
const event = verifyWebhook(rawBody, {
  'svix-id': req.headers['svix-id'],
  'svix-timestamp': req.headers['svix-timestamp'],
  'svix-signature': req.headers['svix-signature'],
}, process.env.KORBIT_WEBHOOK_SECRET);

switch (event.type) {
  case 'payment.succeeded.v1': …
}
```

Erros: `WebhookVerificationError` — **nunca processe o evento** quando a verificação falha. A tolerância de timestamp (anti-replay) é de 5 min por padrão, configurável.

## Opções do cliente

```ts
const korbit = new Korbit({
  apiKey: 'kbt_live_…',     // obrigatório; define o ambiente
  baseUrl: '…',              // override (desenvolvimento/proxies)
  timeoutMs: 30_000,         // timeout por chamada
  maxRetries: 2,             // retries de 429/503/rede
});
```

Por chamada: `{ idempotencyKey?, signal?, … }` — passe um `AbortSignal` para cancelar.

## Escape hatch

Endpoints de streaming (export.csv) e qualquer rota nova antes de virar método:

```ts
const response = await korbit.request('GET', '/v1/orders/export.csv', undefined, {
  query: { view: 'full' },
});
// response.status / response.headers / response.data
```

## Sincronizar com a API

O teste de contrato (`test/contract.test.ts`) compara o SDK com a spec pública e **falha a CI** se a API ganhar endpoint sem cobertura. Depois de atualizar a spec na doc:

```bash
node scripts/sync-spec.mjs   # copia de ../korbit-docs (ou passe o caminho)
npm test
```

## Licença

MIT
