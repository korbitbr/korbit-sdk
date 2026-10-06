/** Erro de resposta da API Korbit (RFC 7807 enriquecido). */
export class KorbitApiError extends Error {
  readonly status: number;
  readonly code: string | null;
  readonly requestId: string | null;

  constructor(status: number, code: string | null, detail: string, requestId: string | null) {
    super(
      `${detail}${code ? ` (code: ${code})` : ''}${requestId ? ` [requestId: ${requestId}]` : ''}`,
    );
    this.name = 'KorbitApiError';
    this.status = status;
    this.code = code;
    this.requestId = requestId;
  }

  /** Limite de requisições atingido — recue com backoff (o cliente padrão já faz isso). */
  get isRateLimited(): boolean {
    return this.status === 429;
  }

  /** Indisponibilidade temporária (fail-closed) — tente novamente mais tarde. */
  get isTemporary(): boolean {
    return this.status >= 500 || this.status === 429;
  }

  /** Requisição malformada ou rejeitada — reenviar não vai resolver. */
  get isClientError(): boolean {
    return this.status >= 400 && this.status < 500 && this.status !== 429;
  }
}
