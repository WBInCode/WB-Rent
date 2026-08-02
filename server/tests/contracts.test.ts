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
    const ciphertext = Buffer.from(parts[3], 'base64url');
    ciphertext[0] ^= 0x01;
    parts[3] = ciphertext.toString('base64url');
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

  it('zwraca czytelny polski komunikat dla zbyt krótkiego numeru dokumentu', () => {
    const result = createContractSchema.safeParse({ ...valid, documentNumber: 'AB' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toEqual(['documentNumber']);
      expect(result.error.issues[0].message).toBe('Numer dokumentu musi mieć co najmniej 3 znaki');
    }
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
        items: [
          {
            productId: 'puzzi-10-1',
            productName: 'Odkurzacz Piorący Kärcher Puzzi 10/1',
            categoryId: 'odkurzacze-piorace',
            itemPrice: 90,
          },
          {
            productId: 'nt-22-1',
            productName: 'Odkurzacz Przemysłowy Kärcher NT 22/1 AP L',
            categoryId: 'odkurzacze-przemyslowe',
            itemPrice: 105,
          },
        ],
        startDate: '2026-08-01',
        endDate: '2026-08-03',
        isIndefinite: false,
        startTime: '09:00',
        endTime: '09:00',
        days: 2,
        totalPrice: 195,
        deposit: 300,
        delivery: false,
        accessories: 'Wąż, ssawka, środek czyszczący',
        conditionNotes: 'Sprzęt sprawny, kompletny, bez uszkodzeń',
      },
      clauses: contractClauses,
    };

    const pdf = await generateContractPdf(snapshot, { renter: signature, lessor: signature }, {
      signedAt: '2026-08-01T08:55:00.000Z',
      signedIp: '127.0.0.1',
      signedUserAgent: 'Vitest Contract Test',
      contentHash: sha256(JSON.stringify(snapshot)),
      renterSignatureHash: sha256(signature),
      lessorSignatureHash: sha256(signature),
    });

    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(pdf.length).toBeGreaterThan(10_000);

    // Regression: WOFF subset fonts produced corrupted Polish text when
    // viewed/copied from the PDF. Full embedded TTF must remain extractable.
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const document = await pdfjs.getDocument({
      data: new Uint8Array(pdf),
      useSystemFonts: true,
    }).promise;
    expect(document.numPages).toBe(2);
    const pages: string[] = [];
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      pages.push(content.items.map((item) => ('str' in item ? item.str : '')).join(' '));
    }
    const extracted = pages.join(' ');
    expect(extracted).toContain('UMOWA NAJMU SPRZĘTU');
    expect(extracted).toContain('Łukasz Wiśniewski');
    expect(extracted).toContain('Odkurzacz Piorący Kärcher');
    expect(extracted).toContain('Odkurzacz Przemysłowy Kärcher NT 22/1');
    expect(extracted).toContain('Sprzęt (pozycje)');
    expect(extracted).toContain('Wynajmujący');
    expect(extracted).toContain('OŚWIADCZENIE I PODPISY STRON');
    expect(extracted).toContain('Anna Żółć');
  });
});
