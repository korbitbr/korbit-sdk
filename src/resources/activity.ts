import type { HttpClient } from '../http-client.js';
import { fetchCursorPage, ResourceBase, type CursorPage, type PageOptions } from './base.js';

export interface ActivityItem {
  [key: string]: unknown;
}

/** Feed unificado e cronológico da conta — leitura humana, não fonte financeira. */
export class ActivityResource extends ResourceBase {
  constructor(client: HttpClient) {
    super(client);
  }

  list(options?: PageOptions & { signal?: AbortSignal }): Promise<CursorPage<ActivityItem>> {
    return fetchCursorPage<ActivityItem>(this.client, '/v1/activity', ResourceBase.query(options ?? {}), options);
  }

  iterate(options?: PageOptions & { signal?: AbortSignal }) {
    return this.iteratePages<ActivityItem>(
      (page) => this.list({ ...options, cursor: page.cursor, limit: page.limit ?? options?.limit }),
      options,
    );
  }
}
