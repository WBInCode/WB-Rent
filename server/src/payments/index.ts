// === PAYMENTS MODULE ENTRY ===
// Active provider is selected via PAYMENT_PROVIDER env: payu | przelewy24 | stripe | none

import { config } from '../config.js';
import type { PaymentProvider } from './types.js';
import { payuProvider } from './payu.js';
import { przelewy24Provider } from './przelewy24.js';
import { stripeProvider } from './stripe.js';

const providers: Record<string, PaymentProvider> = {
  payu: payuProvider,
  przelewy24: przelewy24Provider,
  stripe: stripeProvider,
};

/** The provider chosen in config, or null when payments are disabled/misconfigured. */
export function getActiveProvider(): PaymentProvider | null {
  const name = config.payments.provider;
  if (name === 'none' || !name) return null;

  const provider = providers[name];
  if (!provider) {
    console.warn(`⚠️  Unknown PAYMENT_PROVIDER "${name}" - payments disabled`);
    return null;
  }
  if (!provider.isConfigured()) {
    console.warn(`⚠️  PAYMENT_PROVIDER "${name}" is missing credentials - payments disabled`);
    return null;
  }
  return provider;
}

/** Provider looked up by name (webhook routing) - independent of the active one. */
export function getProviderByName(name: string): PaymentProvider | null {
  return providers[name] || null;
}

export const paymentsEnabled = (): boolean => getActiveProvider() !== null;

export type { PaymentProvider, CreatePaymentInput, CreatePaymentResult, WebhookResult, PaymentStatus } from './types.js';
