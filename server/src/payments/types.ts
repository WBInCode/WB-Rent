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

export type PaymentStatus = 'paid' | 'failed' | 'cancelled' | 'pending' | 'refunded';

export type WebhookResult =
  | {
      ok: true;
      sessionId: string;
      externalId?: string;
      status: PaymentStatus;
      /** Gateway holds the funds and waits for an explicit capture call. */
      needsCapture?: boolean;
    }
  | { ok: false; reason: string };

export interface RefundInput {
  externalId: string;
  /** Missing = full refund. In PLN. */
  amount?: number;
  reason: string;
}

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
  /** Ask the gateway for the current status - used when a webhook never arrives. */
  fetchStatus?(externalId: string): Promise<PaymentStatus | null>;
  /** Confirm an order the gateway is holding for manual acceptance. */
  capture?(externalId: string): Promise<void>;
  refund?(input: RefundInput): Promise<{ refundId?: string }>;
}
