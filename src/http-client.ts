/** Cliente HTTP interno — retries, idempotência, timeout e parse de erros. */
import { randomUUID } from 'node:crypto';
import { KorbitApiError } from './errors.js';

export interface KorbitOptions {
  apiKey: string;
  baseUrl: string;
  timeoutMs?: number;
  maxRetries?: number;
  fetchImpl?: typeof fetch;
}

const MUTATIONS = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);

export interface RequestOptions {
  /** Query string da requisição; valores `undefined`/''/null são descartados. */
  query?: Record<string, unknown>;
  /** Chave de idempotência explícita (mutações geram UUID automaticamente). */
  idempotencyKey?: string;
  /** Sinal de aborto da chamada (timeout + signal do usuário, o que vier primeiro). */
  signal?: AbortSignal;
}

export interface ParsedResponse<T> {
  status: number;
  headers: Headers;
  data: T;
}

export class HttpClient {
  readonly #apiKey: string;
  readonly #baseUrl: string;
  readonly #timeoutMs: number;
  readonly #maxRetries: number;
  readonly #fetch: typeof fetch;

  constructor(options: KorbitOptions) {
    this.#apiKey = options.apiKey;
    this.#baseUrl = options.baseUrl.replace(/\/+$/, '');
    this.#timeoutMs = options.timeoutMs ?? 30_000;
    this.#maxRetries = options.maxRetries ?? 2;
    this.#fetch = options.fetchImpl ?? fetch;
  }

  /** Requisição com retry automático; resolve com status/headers (para streaming). */
  async request<T = unknown>(
    method: string,
    path: string,
    body?: unknown,
    options: RequestOptions = {},
  ): Promise<ParsedResponse<T>> {
    let attempt = 0;
    for (;;) {
      try {
        return await this.#attemptOnce<T>(method, path, body, options);
      } catch (error) {
        if (options.signal?.aborted) throw error; // abort do usuário: nunca re-tentar
        const backoffMs = retryBackoffMs(error);
        if (backoffMs === null || attempt >= this.#maxRetries) throw error;
        await delay(backoffMs + jitter(), options.signal);
        attempt += 1;
      }
    }
  }

  async get<T = unknown>(
    path: string,
    query?: Record<string, unknown>,
    options: RequestOptions = {},
  ): Promise<T> {
    return (await this.request<T>('GET', path, undefined, { ...options, query })).data;
  }

  async post<T = unknown>(
    path: string,
    body?: unknown,
    options: RequestOptions = {},
  ): Promise<T> {
    return (await this.request<T>('POST', path, body, options)).data;
  }

  async put<T = unknown>(path: string, body?: unknown, options: RequestOptions = {}): Promise<T> {
    return (await this.request<T>('PUT', path, body, options)).data;
  }

  async patch<T = unknown>(path: string, body?: unknown, options: RequestOptions = {}): Promise<T> {
    return (await this.request<T>('PATCH', path, body, options)).data;
  }

  async delete<T = unknown>(path: string, options: RequestOptions = {}): Promise<T> {
    return (await this.request<T>('DELETE', path, undefined, options)).data;
  }

  async #attemptOnce<T>(
    method: string,
    path: string,
    body: unknown,
    options: RequestOptions,
  ): Promise<ParsedResponse<T>> {
    const url = new URL(this.#baseUrl + path);
    for (const [key, value] of Object.entries(options.query ?? {})) {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, String(value));
      }
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.#apiKey}`,
      Accept: 'application/json',
    };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (MUTATIONS.has(method)) {
      headers['Idempotency-Key'] = options.idempotencyKey ?? randomUUID();
    }

    const timeoutSignal = AbortSignal.timeout(this.#timeoutMs);
    const signal = combineSignals(options.signal, timeoutSignal);

    let response: Response;
    try {
      response = await this.#fetch(url, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal,
      });
    } catch (error) {
      // Falha de rede/timeout: retriável (mutações são idempotentes). Abort do
      // usuário já foi tratado acima; timeout do AbortSignal é marcado.
      throw new NetworkError(error instanceof Error ? error : new Error(String(error)));
    }

    if (!response.ok) {
      const problem = await parseProblem(response);
      throw withRetryAfter(
        new KorbitApiError(response.status, problem.code, problem.detail, problem.requestId),
        response.headers,
      );
    }
    const data = (await parseBody(response)) as T;
    return { status: response.status, headers: response.headers, data };
  }
}

/** Falha de rede/timeout antes da resposta — retriável por padrão. */
export class NetworkError extends Error {
  constructor(public readonly cause: Error) {
    super(`Falha de rede: ${cause.message}`);
    this.name = 'NetworkError';
  }
}

export function combineSignals(a: AbortSignal | undefined, b: AbortSignal): AbortSignal {
  if (a === undefined) return b;
  if (a.aborted) return a;
  const controller = new AbortController();
  a.addEventListener('abort', () => controller.abort(a.reason), { once: true });
  b.addEventListener('abort', () => controller.abort(b.reason), { once: true });
  return controller.signal;
}

async function parseProblem(response: Response): Promise<{
  detail: string;
  code: string | null;
  requestId: string | null;
}> {
  const text = await response.text().catch(() => '');
  try {
    const problem = JSON.parse(text) as {
      detail?: string;
      title?: string;
      code?: string;
      requestId?: string;
    };
    return {
      detail: (problem.detail ?? problem.title ?? response.statusText) || 'Requisição falhou',
      code: problem.code ?? null,
      requestId: problem.requestId ?? null,
    };
  } catch {
    return { detail: response.statusText || 'Requisição falhou', code: null, requestId: null };
  }
}

async function parseBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (text.length === 0) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

/** ms a aguardar antes do retry, ou null se não é retriável. 429/5xx honram Retry-After; rede usa backoff. */
function retryBackoffMs(error: unknown): number | null {
  if (error instanceof NetworkError) return 500;
  if (!(error instanceof KorbitApiError) || !RETRYABLE_STATUS.has(error.status)) return null;
  const retryAfterMs = (error as unknown as { retryAfterMs?: number }).retryAfterMs;
  return typeof retryAfterMs === 'number' ? retryAfterMs : 500;
}

/** Preserva Retry-After na superfície do erro para o loop de retry. */
function withRetryAfter(error: KorbitApiError, headers: Headers): KorbitApiError {
  const raw = headers.get('retry-after');
  if (raw !== null && /^\d+$/.test(raw)) {
    (error as unknown as { retryAfterMs: number }).retryAfterMs = Number(raw) * 1_000;
  }
  return error;
}

export function jitter(ms = 250): number {
  return Math.random() * ms;
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(signal.reason ?? new Error('aborted'));
      },
      { once: true },
    );
  });
}
