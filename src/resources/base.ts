import type { HttpClient, RequestOptions } from '../http-client.js';

export type Cents = number;

/** Página com cursor — as listagens da Korbit paginam por cursor estável. */
export interface CursorPage<T> {
  data: T[];
  nextCursor: string | null;
}

export interface PageOptions {
  cursor?: string;
  limit?: number;
}

export abstract class ResourceBase {
  protected readonly client: HttpClient;

  constructor(client: HttpClient) {
    this.client = client;
  }

  /** Lê a página seguinte aceitando `next_cursor` e `nextCursor`. */
  static readPage<T>(raw: unknown): CursorPage<T> {
    const page = (raw ?? {}) as {
      data?: T[];
      next_cursor?: unknown;
      nextCursor?: unknown;
    };
    const cursorRaw = page.next_cursor ?? page.nextCursor;
    return {
      data: Array.isArray(page.data) ? page.data : [],
      nextCursor: typeof cursorRaw === 'string' && cursorRaw.length > 0 ? cursorRaw : null,
    };
  }

  /**
   * Itera todas as páginas de uma listagem com cursor.
   * Uso: `for await (const order of korbit.orders.iterate(...)) { ... }`
   */
  protected async *iteratePages<T>(
    fetchPage: (pageOptions: PageOptions) => Promise<CursorPage<T>>,
    options: PageOptions & { maxPages?: number } = {},
  ): AsyncGenerator<T, void, undefined> {
    let cursor = options.cursor;
    let pages = 0;
    do {
      const page = await fetchPage({ cursor: cursor ?? undefined, limit: options.limit });
      for (const item of page.data) yield item;
      cursor = page.nextCursor ?? undefined;
      pages += 1;
    } while (cursor !== undefined && (options.maxPages === undefined || pages < options.maxPages));
  }

  static query(options: object = {}): Record<string, unknown> {
    const { signal: _signal, ...rest } = options as Record<string, unknown>;
    return rest;
  }
}

export type { RequestOptions };

/** Lê uma página com cursor já resolvendo a requisição. */
export async function fetchCursorPage<T>(
  client: HttpClient,
  path: string,
  query: Record<string, unknown> | undefined,
  options?: RequestOptions,
): Promise<CursorPage<T>> {
  return ResourceBase.readPage<T>(await client.get<T>(path, query, options));
}
