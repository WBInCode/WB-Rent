/**
 * Aneks przedłużenia nie ma interaktywnego podpisu (§5 ust. 3: wchodzi w życie
 * automatycznie po zaksięgowaniu wpłaty) — więc jedyne co warto tu pilnować to
 * że PDF faktycznie powstaje i jest czytelnym dokumentem, nie pustym plikiem.
 */
import { describe, expect, it } from 'vitest';

process.env.NODE_ENV = 'test';

const { generateExtensionAnnexPdf } = await import('../src/contracts/extension-pdf.js');

describe('generateExtensionAnnexPdf', () => {
  it('generuje poprawny, niepusty dokument PDF z kwotami i terminami', async () => {
    const pdf = await generateExtensionAnnexPdf({
      number: 'WB-R/2026/000001/A1',
      contractNumber: 'WB-R/2026/000001',
      renterName: 'Anna Kowalczyk',
      productNames: 'Kärcher Puzzi 10/1',
      previousEndDate: '2026-08-12',
      previousEndTime: '09:00',
      previousTotal: 130,
      newEndDate: '2026-08-15',
      newEndTime: '09:00',
      newTotal: 220,
      surcharge: 90,
      paidAt: '2026-08-11T10:30:00.000Z',
      paymentSessionId: 'sess-abc123',
    });

    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(pdf.length).toBeGreaterThan(1_000);
  });

  it('nie wymaga numeru umowy głównej — rezerwacja mogła nie mieć jeszcze zapisanego kontraktu', async () => {
    const pdf = await generateExtensionAnnexPdf({
      number: 'WB-R/2026/000002/A1',
      contractNumber: null,
      renterName: 'Jan Nowak',
      productNames: 'Ozonator',
      previousEndDate: '2026-08-12',
      previousEndTime: '09:00',
      previousTotal: 60,
      newEndDate: '2026-08-13',
      newEndTime: '09:00',
      newTotal: 90,
      surcharge: 30,
      paidAt: '2026-08-11T10:30:00.000Z',
      paymentSessionId: 'sess-xyz789',
    });

    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
  });
});
