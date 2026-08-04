import { describe, it, expect } from 'vitest';
import {
  bestAutomaticDiscount,
  couponRejectionReason,
  discountAmountFor,
  isRuleApplicable,
  resolveDiscount,
  totalWithDiscount,
  type CouponRecord,
  type DiscountContext,
  type DiscountRule,
} from '../src/pricing.js';
import { generateCouponCode } from '../src/coupons.js';
import { couponValidateSchema, discountSchema, reservationSchema } from '../src/schemas.js';

const rule = (overrides: Partial<DiscountRule> = {}): DiscountRule => ({
  id: 1,
  name: 'Promocja',
  discount_type: 'percent',
  value: 10,
  scope: 'all',
  scope_value: '',
  min_days: 1,
  min_total: 0,
  starts_on: null,
  ends_on: null,
  is_active: true,
  ...overrides,
});

const context = (overrides: Partial<DiscountContext> = {}): DiscountContext => ({
  basePrice: 1000,
  days: 3,
  productIds: ['zageszczarka'],
  categoryIds: ['zageszczarki'],
  today: '2025-06-15',
  ...overrides,
});

const coupon = (overrides: Partial<CouponRecord> = {}): CouponRecord => ({
  code: 'WBR-AAAA-BBBB',
  discount_type: 'amount',
  value: 100,
  status: 'active',
  min_total: 0,
  expires_on: null,
  ...overrides,
});

describe('discountAmountFor', () => {
  it('computes percent and fixed amounts', () => {
    expect(discountAmountFor('percent', 10, 1000)).toBe(100);
    expect(discountAmountFor('amount', 150, 1000)).toBe(150);
  });

  it('never exceeds the rentable base price', () => {
    expect(discountAmountFor('amount', 5000, 800)).toBe(800);
    expect(discountAmountFor('percent', 100, 800)).toBe(800);
  });

  it('ignores non-positive input', () => {
    expect(discountAmountFor('percent', 0, 1000)).toBe(0);
    expect(discountAmountFor('amount', -50, 1000)).toBe(0);
    expect(discountAmountFor('amount', 50, 0)).toBe(0);
  });

  it('rounds to grosze', () => {
    expect(discountAmountFor('percent', 33.33, 999)).toBe(332.97);
  });
});

describe('isRuleApplicable', () => {
  it('honours minimum days and minimum total', () => {
    expect(isRuleApplicable(rule({ min_days: 5 }), context({ days: 3 }))).toBe(false);
    expect(isRuleApplicable(rule({ min_total: 2000 }), context())).toBe(false);
    expect(isRuleApplicable(rule({ min_days: 3, min_total: 1000 }), context())).toBe(true);
  });

  it('honours the validity window', () => {
    expect(isRuleApplicable(rule({ starts_on: '2025-07-01' }), context())).toBe(false);
    expect(isRuleApplicable(rule({ ends_on: '2025-06-01' }), context())).toBe(false);
    expect(isRuleApplicable(rule({ starts_on: '2025-06-01', ends_on: '2025-06-30' }), context())).toBe(true);
  });

  it('accepts timestamp-shaped dates from postgres', () => {
    expect(isRuleApplicable(rule({ ends_on: '2025-06-30T00:00:00.000Z' }), context())).toBe(true);
  });

  it('matches product and category scopes', () => {
    expect(isRuleApplicable(rule({ scope: 'product', scope_value: 'zageszczarka' }), context())).toBe(true);
    expect(isRuleApplicable(rule({ scope: 'product', scope_value: 'mlot' }), context())).toBe(false);
    expect(isRuleApplicable(rule({ scope: 'category', scope_value: 'zageszczarki' }), context())).toBe(true);
    expect(isRuleApplicable(rule({ scope: 'category', scope_value: 'pily' }), context())).toBe(false);
  });

  it('skips inactive rules', () => {
    expect(isRuleApplicable(rule({ is_active: false }), context())).toBe(false);
  });
});

describe('bestAutomaticDiscount', () => {
  it('picks the most valuable applicable rule', () => {
    const best = bestAutomaticDiscount(
      [rule({ id: 1, value: 5 }), rule({ id: 2, value: 20 }), rule({ id: 3, value: 10 })],
      context()
    );
    expect(best?.rule.id).toBe(2);
    expect(best?.amount).toBe(200);
  });

  it('returns null when nothing applies', () => {
    expect(bestAutomaticDiscount([rule({ min_days: 30 })], context())).toBeNull();
    expect(bestAutomaticDiscount([], context())).toBeNull();
  });
});

describe('couponRejectionReason', () => {
  it('accepts a valid active coupon', () => {
    expect(couponRejectionReason(coupon(), { basePrice: 1000, today: '2025-06-15' })).toBeNull();
  });

  it('rejects missing, used and cancelled coupons', () => {
    expect(couponRejectionReason(null, { basePrice: 1000, today: '2025-06-15' })).toMatch(/nie istnieje/i);
    expect(couponRejectionReason(coupon({ status: 'used' }), { basePrice: 1000, today: '2025-06-15' }))
      .toMatch(/wykorzystany/i);
    expect(couponRejectionReason(coupon({ status: 'cancelled' }), { basePrice: 1000, today: '2025-06-15' }))
      .toMatch(/anulowany/i);
  });

  it('rejects expired coupons and unmet minimum totals', () => {
    expect(couponRejectionReason(coupon({ expires_on: '2025-06-01' }), { basePrice: 1000, today: '2025-06-15' }))
      .toMatch(/stracił ważność/i);
    expect(couponRejectionReason(coupon({ min_total: 2000 }), { basePrice: 1000, today: '2025-06-15' }))
      .toMatch(/od kwoty/i);
  });

  it('accepts a coupon expiring today', () => {
    expect(couponRejectionReason(coupon({ expires_on: '2025-06-15' }), { basePrice: 1000, today: '2025-06-15' }))
      .toBeNull();
  });
});

describe('resolveDiscount', () => {
  it('returns nothing when no rule or coupon applies', () => {
    expect(resolveDiscount({ rules: [], context: context() })).toEqual({
      amount: 0, code: null, label: '', source: 'none',
    });
  });

  it('uses the automatic rule when it beats the coupon', () => {
    const result = resolveDiscount({
      rules: [rule({ name: 'Lato -20%', value: 20 })],
      coupon: coupon({ value: 50 }),
      context: context(),
    });
    expect(result).toMatchObject({ amount: 200, source: 'automatic', label: 'Lato -20%', code: null });
  });

  it('uses the coupon when it is worth more', () => {
    const result = resolveDiscount({
      rules: [rule({ value: 5 })],
      coupon: coupon({ value: 300 }),
      context: context(),
    });
    expect(result).toMatchObject({ amount: 300, source: 'coupon', code: 'WBR-AAAA-BBBB' });
  });

  it('never stacks a coupon on top of an automatic rule', () => {
    const result = resolveDiscount({
      rules: [rule({ value: 10 })],
      coupon: coupon({ value: 100 }),
      context: context(),
    });
    expect(result.amount).toBe(100);
  });

  it('ignores an invalid coupon and falls back to the automatic rule', () => {
    const result = resolveDiscount({
      rules: [rule({ value: 10 })],
      coupon: coupon({ status: 'used', value: 900 }),
      context: context(),
    });
    expect(result).toMatchObject({ amount: 100, source: 'automatic' });
  });
});

describe('totalWithDiscount', () => {
  it('discounts only the rent, never the fees', () => {
    expect(totalWithDiscount({ basePrice: 1000, deliveryFee: 40, weekendPickupFee: 30, discountAmount: 100 }))
      .toBe(970);
  });

  it('keeps fees payable even at a full rent discount', () => {
    expect(totalWithDiscount({ basePrice: 500, deliveryFee: 40, weekendPickupFee: 0, discountAmount: 500 }))
      .toBe(40);
  });

  it('never returns a negative total', () => {
    expect(totalWithDiscount({ basePrice: 500, deliveryFee: 0, weekendPickupFee: 0, discountAmount: 900 }))
      .toBe(0);
  });
});

describe('generateCouponCode', () => {
  it('uses the WBR-XXXX-XXXX shape without ambiguous characters', () => {
    for (let i = 0; i < 50; i += 1) {
      expect(generateCouponCode()).toMatch(/^WBR-[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{4}-[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{4}$/);
    }
  });

  it('does not repeat codes', () => {
    const codes = new Set(Array.from({ length: 500 }, () => generateCouponCode()));
    expect(codes.size).toBe(500);
  });
});

describe('discountSchema', () => {
  const base = { name: 'Lato', discountType: 'percent' as const, value: 10 };

  it('rejects a percent discount above 100', () => {
    expect(discountSchema.safeParse({ ...base, value: 120 }).success).toBe(false);
  });

  it('requires a target for scoped discounts', () => {
    expect(discountSchema.safeParse({ ...base, scope: 'product' }).success).toBe(false);
    expect(discountSchema.safeParse({ ...base, scope: 'product', scopeValue: 'mlot' }).success).toBe(true);
  });

  it('rejects an inverted validity window', () => {
    expect(discountSchema.safeParse({ ...base, startsOn: '2025-07-01', endsOn: '2025-06-01' }).success).toBe(false);
  });

  it('applies defaults', () => {
    const parsed = discountSchema.parse(base);
    expect(parsed).toMatchObject({ scope: 'all', minDays: 1, minTotal: 0, isActive: true, startsOn: null });
  });
});

describe('couponValidateSchema', () => {
  it('uppercases the submitted code', () => {
    expect(couponValidateSchema.parse({ code: 'wbr-aaaa-bbbb' }).code).toBe('WBR-AAAA-BBBB');
  });

  it('rejects codes with injection characters', () => {
    expect(couponValidateSchema.safeParse({ code: "WBR' OR 1=1--" }).success).toBe(false);
  });
});

describe('staffPricing (reservationSchema)', () => {
  const base = {
    categoryId: 'ozonatory',
    productId: 'ozonmed-pro-10g',
    productName: 'Ozonator',
    startDate: '2026-08-10',
    endDate: '2026-08-12',
    startTime: '09:00',
    endTime: '09:00',
    days: 2,
    delivery: false,
    firstName: 'Jan',
    lastName: 'Kowalski',
    email: 'jan@example.com',
    phone: '570038828',
    totalPrice: 100,
  };

  it('accepts an employee price and discount', () => {
    const parsed = reservationSchema.parse({
      ...base,
      staffPricing: { priceOverride: 80, discountAmount: 20, note: 'stały klient', setBy: 'Anna' },
    });
    expect(parsed.staffPricing).toMatchObject({ priceOverride: 80, discountAmount: 20, setBy: 'Anna' });
  });

  it('rejects a negative price or discount', () => {
    expect(reservationSchema.safeParse({ ...base, staffPricing: { priceOverride: -1 } }).success).toBe(false);
    expect(reservationSchema.safeParse({ ...base, staffPricing: { discountAmount: -5 } }).success).toBe(false);
  });

  it('stays optional for public reservations', () => {
    expect(reservationSchema.parse(base).staffPricing).toBeUndefined();
  });
});
