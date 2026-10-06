import type { HttpClient } from '../http-client.js';
import { fetchCursorPage, ResourceBase, type CursorPage, type PageOptions } from './base.js';
import type { Cents } from './base.js';

export interface CreateProductInput {
  name: string;
  description?: string;
  externalReference?: string;
}

export interface Product {
  id: string;
  name: string;
  description?: string | null;
  status?: string;
  [key: string]: unknown;
}

export interface CreatePriceInput {
  /** Valor em centavos (BRL). Ex.: 14990 = R$ 149,90. */
  amountMinor: Cents;
  currency?: 'BRL';
}

export interface PriceVersion {
  id: string;
  amountMinor: Cents;
  currency: 'BRL';
  createdAt?: string;
  [key: string]: unknown;
}

export interface CreateOfferInput {
  priceId: string;
  paymentMethods: Array<'PIX' | 'CARD'>;
  maxInstallments?: number;
}

export interface Offer {
  id: string;
  status?: string;
  publicCode?: string | null;
  [key: string]: unknown;
}

export class CatalogResource extends ResourceBase {
  readonly products: ProductsGroup;
  readonly offers: OffersGroup;

  constructor(client: HttpClient) {
    super(client);
    this.products = new ProductsGroup(client);
    this.offers = new OffersGroup(client);
  }
}

export class ProductsGroup {
  readonly #client: HttpClient;

  constructor(client: HttpClient) {
    this.#client = client;
  }

  create(input: CreateProductInput, options?: { idempotencyKey?: string; signal?: AbortSignal }): Promise<Product> {
    return this.#client.post<Product>('/v1/products', input, options);
  }

  list(options?: PageOptions & { signal?: AbortSignal }): Promise<CursorPage<Product>> {
    return fetchCursorPage<Product>(
      this.#client,
      '/v1/products',
      ResourceBase.query(options ?? {}),
      options,
    );
  }

  get(id: string, options?: { signal?: AbortSignal }): Promise<Product> {
    return this.#client.get<Product>(`/v1/products/${id}`, undefined, options);
  }

  update(id: string, input: Partial<CreateProductInput>, options?: { idempotencyKey?: string; signal?: AbortSignal }): Promise<Product> {
    return this.#client.patch<Product>(`/v1/products/${id}`, input, options);
  }

  archive(id: string, options?: { idempotencyKey?: string; signal?: AbortSignal }): Promise<void> {
    return this.#client.post<void>(`/v1/products/${id}/archive`, undefined, options);
  }

  /** Cria uma nova versão de preço (histórico preservado — nunca edite preço no lugar). */
  createPrice(productId: string, input: CreatePriceInput, options?: { idempotencyKey?: string; signal?: AbortSignal }): Promise<PriceVersion> {
    return this.#client.post<PriceVersion>(`/v1/products/${productId}/prices`, input, options);
  }

  listPrices(productId: string, options?: PageOptions & { signal?: AbortSignal }): Promise<CursorPage<PriceVersion>> {
    return fetchCursorPage<PriceVersion>(
      this.#client,
      `/v1/products/${productId}/prices`,
      ResourceBase.query(options ?? {}),
      options,
    );
  }

  createOffer(productId: string, input: CreateOfferInput, options?: { idempotencyKey?: string; signal?: AbortSignal }): Promise<Offer> {
    return this.#client.post<Offer>(`/v1/products/${productId}/offers`, input, options);
  }

  listOffers(productId: string, options?: PageOptions & { signal?: AbortSignal }): Promise<CursorPage<Offer>> {
    return fetchCursorPage<Offer>(
      this.#client,
      `/v1/products/${productId}/offers`,
      ResourceBase.query(options ?? {}),
      options,
    );
  }

  /** Upload de imagem em 3 passos: createUpload → PUT no storage → completeUpload. */
  createImageUpload(productId: string, input: Record<string, unknown>, options?: { idempotencyKey?: string; signal?: AbortSignal }): Promise<Record<string, unknown>> {
    return this.#client.post(`/v1/products/${productId}/image-uploads`, input, options);
  }

  getImageUpload(productId: string, uploadId: string, options?: { signal?: AbortSignal }): Promise<Record<string, unknown>> {
    return this.#client.get(`/v1/products/${productId}/image-uploads/${uploadId}`, undefined, options);
  }

  completeImageUpload(productId: string, uploadId: string, options?: { idempotencyKey?: string; signal?: AbortSignal }): Promise<Record<string, unknown>> {
    return this.#client.post(`/v1/products/${productId}/image-uploads/${uploadId}/complete`, undefined, options);
  }

  getTracking(productId: string, options?: { signal?: AbortSignal }): Promise<Record<string, unknown>> {
    return this.#client.get(`/v1/products/${productId}/tracking-integrations`, undefined, options);
  }

  replaceTracking(productId: string, input: Record<string, unknown>, options?: { idempotencyKey?: string; signal?: AbortSignal }): Promise<Record<string, unknown>> {
    return this.#client.put(`/v1/products/${productId}/tracking-integrations`, input, options);
  }

  listTrackingEvents(productId: string, options?: PageOptions & { signal?: AbortSignal }): Promise<CursorPage<Record<string, unknown>>> {
    return fetchCursorPage<Record<string, unknown>>(
      this.#client,
      `/v1/products/${productId}/tracking-events`,
      ResourceBase.query(options ?? {}),
      options,
    );
  }
}

export class OffersGroup {
  readonly #client: HttpClient;

  constructor(client: HttpClient) {
    this.#client = client;
  }

  get(id: string, options?: { signal?: AbortSignal }): Promise<Offer> {
    return this.#client.get<Offer>(`/v1/offers/${id}`, undefined, options);
  }

  update(id: string, input: Record<string, unknown>, options?: { idempotencyKey?: string; signal?: AbortSignal }): Promise<Offer> {
    return this.#client.patch<Offer>(`/v1/offers/${id}`, input, options);
  }

  /** Cria revisão da oferta (condições novas com histórico preservado). */
  revise(id: string, input: Record<string, unknown>, options?: { idempotencyKey?: string; signal?: AbortSignal }): Promise<Offer> {
    return this.#client.post<Offer>(`/v1/offers/${id}/revisions`, input, options);
  }

  /** Publica a oferta e habilita o link de pagamento. */
  publish(id: string, options?: { idempotencyKey?: string; signal?: AbortSignal }): Promise<Offer> {
    return this.#client.post<Offer>(`/v1/offers/${id}/publish`, undefined, options);
  }

  archive(id: string, options?: { idempotencyKey?: string; signal?: AbortSignal }): Promise<void> {
    return this.#client.post<void>(`/v1/offers/${id}/archive`, undefined, options);
  }
}
