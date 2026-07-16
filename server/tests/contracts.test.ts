import { describe, expect, it } from 'vitest';

process.env.NODE_ENV = 'test';
process.env.ADMIN_TOKEN = 'contract-test-secret';
process.env.CONTRACT_ENCRYPTION_KEY = 'contract-encryption-test-secret-32-bytes-min';

const { encryptContractData, decryptContractData, sha256, randomSigningToken, signingTokenHash } =
  await import('../src/contracts/crypto.js');
const { createContractSchema } = await import('../src/contracts/service.js');
const { generateContractPdf } = await import('../src/contracts/pdf.js');
const { contractClauses, CONTRACT_TEMPLATE_VERSION } = await import('../src/contracts/template.js');

describe('szyfrowanie umów AES-256-GCM', () => {
  it('round-trip zachowuje polskie znaki i dane dokumentu', () => {
    const source = JSON.stringify({ name: 'Łukasz Żółć', document: 'ABC 123456', pesel: '90010112345' });
    const encrypted = encryptContractData(source);
    expect(encrypted).not.toContain('ABC 123456');
    expect(decryptContractData(encrypted).toString('utf8')).toBe(source);
  });

  it('wykrywa modyfikację ciphertextu (GCM auth tag)', () => {
    const encrypted = encryptContractData('tajne dane');
    const parts = encrypted.split(':');
    parts[3] = parts[3].slice(0, -2) + 'xx';
    expect(() => decryptContractData(parts.join(':'))).toThrow();
  });

  it('szyfruje i odszyfrowuje dane binarne (PDF / PNG)', () => {
    const binary = Buffer.from([0, 255, 137, 80, 78, 71, 10, 13, 42, 0, 128]);
    const encrypted = encryptContractData(binary);
    expect(decryptContractData(encrypted)).toEqual(binary);
  });

  it('token sesji ma wysoką entropię i jest przechowywany tylko jako hash', () => {
    const tokenA = randomSigningToken();
    const tokenB = randomSigningToken();
    expect(tokenA).not.toBe(tokenB);
    expect(tokenA.length).toBeGreaterThanOrEqual(40);
    expect(signingTokenHash(tokenA)).toHaveLength(64);
    expect(signingTokenHash(tokenA)).not.toContain(tokenA);
  });
});

describe('walidacja danych umowy', () => {
  const valid = {
    reservationId: 1,
    renterAddress: 'ul. Testowa 1, 35-001 Rzeszów',
    documentType: 'dowod_osobisty' as const,
    documentNumber: 'ABC 123456',
    pesel: '90010112345',
    employeeName: 'Jan Pracownik',
    deposit: 300,
    accessories: 'Wąż, ssawka, instrukcja',
    conditionNotes: 'Sprzęt sprawny i kompletny',
  };

  it('akceptuje kompletne dane', () => {
    expect(createContractSchema.parse(valid)).toEqual(valid);
  });

  it('odrzuca błędny PESEL, pusty adres i ujemną kaucję', () => {
    expect(() => createContractSchema.parse({ ...valid, pesel: '123' })).toThrow();
    expect(() => createContractSchema.parse({ ...valid, renterAddress: '' })).toThrow();
    expect(() => createContractSchema.parse({ ...valid, deposit: -1 })).toThrow();
  });

  it('odrzuca znaki sterujące w numerze dokumentu', () => {
    expect(() => createContractSchema.parse({ ...valid, documentNumber: '<script>' })).toThrow();
  });
});

describe('generator podpisanej umowy PDF', () => {
  it('tworzy wielostronicowy PDF z polskimi znakami i metryką', async () => {
    const signature = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
      'base64'
    );
    const snapshot = {
      contractNumber: 'WB-R/2026/000001',
      templateVersion: CONTRACT_TEMPLATE_VERSION,
      generatedAt: new Date().toISOString(),
      lessor: {
        name: 'WB Partners Sp. z o.o.',
        address: 'ul. Juliusza Słowackiego 24/11, 35-060 Rzeszów',
        nip: '5170455185',
        representative: 'Anna Żółć',
      },
      renter: {
        name: 'Łukasz Wiśniewski',
        email: 'klient@example.com',
        phone: '600100200',
        address: 'ul. Łąkowa 5, Rzeszów',
        documentType: 'dowod_osobisty' as const,
        documentNumber: 'ABC 123456',
        pesel: '90010112345',
      },
      rental: {
        reservationId: 1,
        productId: 'puzzi-10-1',
        productName: 'Odkurzacz Piorący Kärcher Puzzi 10/1',
        startDate: '2026-08-01',
        endDate: '2026-08-03',
        startTime: '09:00',
        endTime: '09:00',
        days: 2,
        totalPrice: 90,
        deposit: 300,
        delivery: false,
        accessories: 'Wąż, ssawka, środek czyszczący',
        conditionNotes: 'Sprzęt sprawny, kompletny, bez uszkodzeń',
      },
      clauses: contractClauses,
    };

    const pdf = await generateContractPdf(snapshot, signature, {
      signedAt: '2026-08-01T08:55:00.000Z',
      signedIp: '127.0.0.1',
      signedUserAgent: 'Vitest Contract Test',
      contentHash: sha256(JSON.stringify(snapshot)),
      signatureHash: sha256(signature),
    });

    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(pdf.length).toBeGreaterThan(10_000);
  });
});
