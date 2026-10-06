/**
 * Teste de contrato SDK ↔ OpenAPI: toda operação da spec pública deve estar
 * coberta por um recurso do SDK ou listada em EXCLUDED_OPERATIONS.
 * Falha quando a API ganha endpoint novo sem cobertura — evita drift.
 *
 * Atualizar o fixture: `node scripts/sync-spec.mjs` (copia do repo korbit-docs).
 */
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { test } from 'node:test';

const SPEC = JSON.parse(
  readFileSync(new URL('./fixtures/korbit-public-v1.json', import.meta.url), 'utf8'),
) as { paths: Record<string, Record<string, unknown>> };

const HTTP_METHODS = new Set(['get', 'post', 'patch', 'put', 'delete']);

/** Endpoints deliberadamente fora do SDK (streaming CSV tem fluxo próprio via korbit.request). */
const EXCLUDED_PATHS = new Set([
  '/v1/customers/export.csv',
  '/v1/orders/export.csv',
  '/v1/subscriptions/export.csv',
]);

function specOperations(): Array<{ method: string; path: string }> {
  const operations: Array<{ method: string; path: string }> = [];
  for (const [path, item] of Object.entries(SPEC.paths ?? {})) {
    for (const method of Object.keys(item)) {
      if (HTTP_METHODS.has(method)) operations.push({ method: method.toUpperCase(), path });
    }
  }
  return operations;
}

/** Caminhos literais usados nos recursos (templates `${...}` viram `{param}`). */
function coveredPaths(): Set<string> {
  const covered = new Set<string>();
  const dir = new URL('../src/resources/', import.meta.url);
  for (const file of readdirSync(dir)) {
    if (!file.endsWith('.ts')) continue;
    const source = readFileSync(new URL(`./${file}`, dir), 'utf8');
    for (const match of source.matchAll(/'([^']*)'|`([^`]*)`/g)) {
      const literal = (match[1] ?? match[2] ?? '') as string;
      if (!literal.includes('/v1/')) continue;
      const normalized = literal
        .replace(/\$\{[^}]*\}/g, '{param}')
        .replace(/\{[^/]*\}/g, '{param}')
        .split('?')[0] ?? '';
      covered.add(normalized);
    }
  }
  return covered;
}

function normalizeSpecPath(path: string): string {
  return path.replace(/\{[^/]+\}/g, '{param}');
}

test('toda operação da spec pública está coberta pelo SDK (ou excluída explicitamente)', () => {
  const covered = coveredPaths();
  const missing: string[] = [];
  for (const { path } of specOperations()) {
    const normalized = normalizeSpecPath(path);
    if (EXCLUDED_PATHS.has(path)) continue;
    if (!covered.has(normalized)) missing.push(path);
  }
  assert.deepEqual(missing, [], `endpoints da API sem cobertura no SDK:\n  ${missing.join('\n  ')}`);
});

test('caminhos do SDK não inventam endpoints fora da spec', () => {
  const specPaths = new Set(Object.keys(SPEC.paths ?? {}).map(normalizeSpecPath));
  const inventados: string[] = [];
  for (const path of coveredPaths()) {
    if (!specPaths.has(path)) inventados.push(path);
  }
  assert.deepEqual(inventados, [], `caminhos no SDK que não existem na API:\n  ${inventados.join('\n  ')}`);
});

test('tipos de evento do SDK = catálogo da spec', async () => {
  const { WEBHOOK_EVENT_TYPES } = await import('../src/resources/webhooks.js');
  const createSchema = (SPEC.paths['/v1/webhook-subscriptions'] as Record<string, { post?: unknown }>).post as {
    requestBody?: { content?: Record<string, { schema?: unknown }> };
  };
  const schema = JSON.stringify(createSchema.requestBody?.content ?? {});
  const match = schema.match(/"enum":\[([^\]]*payment\.created[^\]]*)\]/s);
  assert.ok(match, 'enum de eventTypes não encontrado na spec');
  const specEvents = (match[1] ?? '')
    .split(',')
    .map((entry) => entry.trim().replace(/['"]/g, ''))
    .filter((entry) => entry.length > 0);
  assert.deepEqual(
    [...WEBHOOK_EVENT_TYPES].sort(),
    [...specEvents].sort(),
    'WEBHOOK_EVENT_TYPES divergiu da spec — novos eventos precisam entrar no SDK',
  );
});
