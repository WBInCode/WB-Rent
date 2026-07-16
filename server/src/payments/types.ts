// === PAYMENT PROVIDER ABSTRACTION ===
// Common interface implemented by payu.ts / przelewy24.ts / stripe.ts.
// Active module selected via PAYMENT_PROVIDER env (see payments/index.ts).

export interface CreatePaymentInput {
  /** Our unique payment session id (sent to the provider as external order id). */
  sessionId: string;
  /** Amount in PLN (złote, e.g. 135.50). */
  amount: number;
  description: string;
  customerEmail: string;
  customerIp: string;
  /** Where the customer is redirected after finishing the payment. */
  returnUrl: string;
  /** Public webhook URL for this provider's notifications. */
  notifyUrl: string;
}

export interface CreatePaymentResult {
  /** Gateway checkout URL to redirect the customer to. */
  redirectUrl: string;
  /** Provider-side order/session id. */
  externalId?: string;
}

export type PaymentStatus = 'paid' | 'failed' | 'cancelled' | 'pending';

export type WebhookResult =
  | { ok: true; sessionId: string; externalId?: string; status: PaymentStatus }
  | { ok: false; reason: string };

export interface PaymentProvider {
  readonly name: 'payu' | 'przelewy24' | 'stripe';
  /** True when all required credentials are configured. */
  isConfigured(): boolean;
  createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult>;
  /**
   * Verify signature and parse an incoming webhook notification.
   * rawBody is the exact bytes received (required for signature verification).
   */
  handleWebhook(
    headers: Record<string, string | string[] | undefined>,
    rawBody: Buffer
  ): Promise<WebhookResult>;
}
