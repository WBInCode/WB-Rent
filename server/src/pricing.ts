// Discount and coupon money rules.
//
// Pure functions with no database access, so the pricing math can be unit
// tested and stays identical on every call site (public reservation form,
// staff rental flow and admin previews).

export type DiscountType = 'percent' | 'amount';

export interface DiscountRule {
  id: number;
  name: string;
  discount_type: DiscountType;
  value: number;
  scope: 'all' | 'category' | 'product';
  scope_value: string;
  min_days: number;
  min_total: number;
  starts_on: string | null;
  ends_on: string | null;
  is_active: boolean;
}

export interface CouponRecord {
  code: string;
  discount_type: DiscountType;
  value: number;
  status: string;
  min_total: number;
  expires_on: string | null;
}

export interface DiscountContext {
  /** Equipment rent only — delivery and weekend fees are never discounted. */
  basePrice: number;
  days: number;
  productIds: string[];
  categoryIds: string[];
  /** YYYY-MM-DD */
  today: string;
}

export interface ResolvedDiscount {
  amount: number;
  code: string | null;
  label: string;
  source: 'none' | 'automatic' | 'coupon';
}

const round2 = (value: number) => Math.round(value * 100) / 100;

const pad = (value: number) => String(value).padStart(2, '0');

/** Server-local YYYY-MM-DD (toISOString would shift the day on non-UTC hosts). */
export const todayLocal = (): string => {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
};

const asDate = (value: string | null): string | null =>
  value ? String(value).slice(0, 10) : null;

/** Discount value, clamped to the rentable amount (never negative, never above base). */
export const discountAmountFor = (type: DiscountType, value: number, basePrice: number): number => {
  if (!(basePrice > 0) || !(value > 0)) return 0;
  const raw = type === 'percent' ? (basePrice * value) / 100 : value;
  return round2(Math.min(raw, basePrice));
};

export const isRuleApplicable = (rule: DiscountRule, context: DiscountContext): boolean => {
  if (!rule.is_active) return false;
  if (context.days < rule.min_days) return false;
  if (context.basePrice < rule.min_total) return false;

  const startsOn = asDate(rule.starts_on);
  const endsOn = asDate(rule.ends_on);
  if (startsOn && context.today < startsOn) return false;
  if (endsOn && context.today > endsOn) return false;

  if (rule.scope === 'product') return context.productIds.includes(rule.scope_value);
  if (rule.scope === 'category') return context.categoryIds.includes(rule.scope_value);
  return true;
};

/** Best automatic promotion for the cart, or null when nothing applies. */
export const bestAutomaticDiscount = (
  rules: DiscountRule[],
  context: DiscountContext
): { rule: DiscountRule; amount: number } | null => {
  let best: { rule: DiscountRule; amount: number } | null = null;
  for (const rule of rules) {
    if (!isRuleApplicable(rule, context)) continue;
    const amount = discountAmountFor(rule.discount_type, Number(rule.value), context.basePrice);
    if (amount <= 0) continue;
    if (!best || amount > best.amount) best = { rule, amount };
  }
  return best;
};

/** Human-readable rejection reason, or null when the coupon can be used. */
export const couponRejectionReason = (
  coupon: CouponRecord | null | undefined,
  context: { basePrice: number; today: string }
): string | null => {
  if (!coupon) return 'Kupon nie istnieje lub został już wykorzystany';
  if (coupon.status === 'used') return 'Ten kupon został już wykorzystany';
  if (coupon.status === 'cancelled') return 'Ten kupon został anulowany';
  if (coupon.status !== 'active') return 'Kupon jest nieaktywny';

  const expiresOn = asDate(coupon.expires_on);
  if (expiresOn && context.today > expiresOn) return `Kupon stracił ważność ${expiresOn}`;
  if (context.basePrice < Number(coupon.min_total)) {
    return `Kupon obowiązuje od kwoty najmu ${Number(coupon.min_total).toFixed(2)} zł`;
  }
  return null;
};

/**
 * Single best discount wins: an automatic promotion and a coupon never stack,
 * the customer simply gets whichever is worth more. Keeps totals predictable
 * and blocks stacking abuse.
 */
export const resolveDiscount = (input: {
  rules: DiscountRule[];
  coupon?: CouponRecord | null;
  context: DiscountContext;
}): ResolvedDiscount => {
  const automatic = bestAutomaticDiscount(input.rules, input.context);
  const couponUsable =
    input.coupon && !couponRejectionReason(input.coupon, input.context) ? input.coupon : null;
  const couponAmount = couponUsable
    ? discountAmountFor(couponUsable.discount_type, Number(couponUsable.value), input.context.basePrice)
    : 0;

  if (couponAmount > 0 && (!automatic || couponAmount >= automatic.amount)) {
    return {
      amount: couponAmount,
      code: couponUsable!.code,
      label: `Kupon ${couponUsable!.code}`,
      source: 'coupon',
    };
  }
  if (automatic) {
    return { amount: automatic.amount, code: null, label: automatic.rule.name, source: 'automatic' };
  }
  return { amount: 0, code: null, label: '', source: 'none' };
};

/** Final order total; the discount only ever reduces the equipment rent. */
export const totalWithDiscount = (input: {
  basePrice: number;
  deliveryFee: number;
  weekendPickupFee: number;
  discountAmount: number;
}): number =>
  round2(
    Math.max(input.basePrice - input.discountAmount, 0) + input.deliveryFee + input.weekendPickupFee
  );
