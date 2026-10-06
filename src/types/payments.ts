import type { Cents } from '../resources/base.js';

export type PaymentMethod = 'PIX' | 'CARD';

export interface CreatePaymentIntentInput {
  /** Valor total em centavos (BRL). Ex.: 14990 = R$ 149,90. */
  amount: Cents;
  paymentMethod: PaymentMethod;
  description?: string;
  externalReference?: string;
  expiresInSeconds?: number;
}

export interface PaymentIntent {
  id: string;
  status: 'REQUIRES_ACTION' | 'SUCCEEDED' | 'FAILED' | 'CANCELED';
  amount: Cents;
  currency: 'BRL';
  paymentMethod: PaymentMethod;
  description?: string | null;
  externalReference?: string | null;
  pix?: { copyAndPaste: string };
  cardAction?: { externalResourceUrl: string; expiresAt: string };
  createdAt?: string;
  [key: string]: unknown;
}
