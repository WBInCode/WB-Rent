import { describe, expect, it } from 'vitest';

process.env.NODE_ENV = 'test';
process.env.ADMIN_TOKEN = 'contract-test-secret';
process.env.CONTRACT_ENCRYPTION_KEY = 'contract-encryption-test-secret-32-bytes-min';

const { encryptContractData, decryptContractData, sha256, randomSigningToken, signingTokenHash } =
  await import('../src/contracts/crypto.js');
const { createContractSchema, buildDefaultHandoverItems } = await import('../src/contracts/service.js');
const { generateContractPdf } = await import('../src/contracts/pdf.js');
const { buildContractClauses, CONTRACT_TEMPLATE_VERSION } = await import('../src/contracts/template.js');

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

  it('wymaga numeru PESEL', () => {
    const result = createContractSchema.safeParse({ ...valid, pesel: '' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toEqual(['pesel']);
      expect(result.error.issues[0].message).toBe('PESEL musi składać się dokładnie z 11 cyfr');
    }
  });

  it('dopuszcza pusty numer dokumentu', () => {
    const parsed = createContractSchema.parse({ ...valid, documentNumber: '' });
    expect(parsed.documentNumber).toBe('');
  });

  it('dopuszcza kaucję zerową', () => {
    expect(createContractSchema.parse({ ...valid, deposit: 0 }).deposit).toBe(0);
  });

  it('przyjmuje poprawiony protokół wydania i odrzuca puste pozycje', () => {
    const parsed = createContractSchema.parse({ ...valid, handoverItems: ['Odkurzacz', 'Wąż ssący'] });
    expect(parsed.handoverItems).toEqual(['Odkurzacz', 'Wąż ssący']);
    expect(() => createContractSchema.parse({ ...valid, handoverItems: ['x'] })).toThrow();
  });
});

describe('treść umowy względem dokumentów papierowych', () => {
  const puzzi = {
    deviceName: 'Kärcher Puzzi 10/1',
    equipmentValue: 4551,
    includedConsumables: '2 × 100 g środka czyszczącego Kärcher RM 760',
    extraConsumable: { label: 'RM 760 (100 g)', price: 10 },
    deepCleaningNote: 'zabrudzone zbiorniki',
  };
  const nt22 = {
    deviceName: 'Kärcher NT 22/1 Ap L',
    equipmentValue: 984,
    mandatoryConsumable: { label: 'worek filtrujący', price: 15, note: 'Worki są materiałem zużywalnym.' },
    deepCleaningNote: 'zabrudzony filtr',
  };
  const period = 'od dnia 01.08.2026 r., godz. 09:00 (wydanie) do dnia 03.08.2026 r., godz. 09:00 (zwrot)';

  it('zachowuje numerację paragrafów z umowy papierowej wraz z §2a i §3a', () => {
    const clauses = buildContractClauses({ devices: [puzzi], rentalPeriod: period, totalPrice: 90, deposit: 0, dailyRate: 45 });
    expect(clauses.map((clause) => clause.number)).toEqual(
      ['1', '2', '2a', '3', '3a', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13']
    );
    expect(clauses.every((clause) => (clause.points?.length ?? 0) > 0)).toBe(true);
  });

  it('§1 podaje realny okres najmu i wartość sprzętu', () => {
    const [first] = buildContractClauses({ devices: [puzzi], rentalPeriod: period, totalPrice: 90, deposit: 0, dailyRate: 45 });
    expect(first.points?.[1]).toContain('4 551,00 zł');
    expect(first.points?.[2]).toContain('01.08.2026');
    expect(first.points?.[2]).toContain('03.08.2026');
  });

  it('przy kilku urządzeniach wymienia każde z osobna i sumuje wartości', () => {
    const clauses = buildContractClauses({ devices: [puzzi, nt22], rentalPeriod: period, totalPrice: 195, deposit: 0, dailyRate: 45 });
    const subject = clauses[0].points?.[0] || '';
    expect(subject).toContain('1) Kärcher Puzzi 10/1');
    expect(subject).toContain('2) Kärcher NT 22/1 Ap L');
    expect(clauses[0].points?.[1]).toContain('łącznie 5 535,00 zł');

    const cennik = clauses.find((clause) => clause.number === '12');
    expect(cennik?.points?.some((point) => point.includes('worek filtrujący') && point.includes('NT 22/1'))).toBe(true);
    expect(cennik?.points?.some((point) => point.includes('RM 760') && point.includes('Puzzi 10/1'))).toBe(true);
  });

  it('§2a rozróżnia najem z kaucją i bez kaucji', () => {
    const withDeposit = buildContractClauses({ devices: [puzzi], rentalPeriod: period, totalPrice: 90, deposit: 300, dailyRate: 45 });
    const without = buildContractClauses({ devices: [puzzi], rentalPeriod: period, totalPrice: 90, deposit: 0, dailyRate: 45 });
    expect(withDeposit.find((clause) => clause.number === '2a')?.points?.[0]).toContain('300,00 zł');
    expect(without.find((clause) => clause.number === '2a')?.points?.[0]).toContain('kaucja wynosi 0,00 zł');
  });

  it('protokół wydania przypisuje pozycje do konkretnego urządzenia', () => {
    const single = buildDefaultHandoverItems(['puzzi-10-1']);
    expect(single[0]).toBe('Odkurzacz Kärcher Puzzi 10/1');

    const many = buildDefaultHandoverItems(['puzzi-10-1', 'nt-22-1']);
    expect(many[0]).toMatch(/^1\) Kärcher Puzzi 10\/1 — /);
    expect(many.some((line) => line.startsWith('2) Kärcher NT 22/1 Ap L — '))).toBe(true);
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
      clauses: buildContractClauses({
        devices: [
          {
            deviceName: 'Kärcher Puzzi 10/1',
            equipmentValue: 4551,
            includedConsumables: '2 × 100 g środka czyszczącego Kärcher RM 760',
            extraConsumable: { label: 'RM 760 (100 g)', price: 10 },
            deepCleaningNote: 'zabrudzone zbiorniki',
          },
          {
            deviceName: 'Kärcher NT 22/1 Ap L',
            equipmentValue: 984,
            mandatoryConsumable: {
              label: 'worek filtrujący',
              price: 15,
              note: 'Worki wydawane są w oryginalnych opakowaniach jednostkowych.',
            },
            deepCleaningNote: 'zabrudzony filtr',
          },
        ],
        rentalPeriod: 'od dnia 01.08.2026 r., godz. 09:00 (wydanie) do dnia 03.08.2026 r., godz. 09:00 (zwrot)',
        totalPrice: 195,
        deposit: 300,
        dailyRate: 45,
      }),
      handoverItems: ['Odkurzacz Kärcher Puzzi 10/1', 'Wąż spryskująco-odsysający 2,5 m'],
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
    expect(document.numPages).toBeGreaterThanOrEqual(2);
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

    // Treść z papierowej umowy, nie z wcześniejszego szablonu ogólnego.
    expect(extracted).toContain('ERPIX');
    expect(extracted).toContain('SPRZĘT NIE JEST UBEZPIECZONY');
    expect(extracted).toContain('4 551,00 zł');
    expect(extracted).toContain('PROTOKÓŁ WYDANIA SPRZĘTU');
  });

  it('dołącza instrukcję obsługi i klauzulę RODO do wiadomości', async () => {
    const { collectRentalAttachments } = await import('../src/rental-attachments.js');

    const attachments = await collectRentalAttachments(['puzzi-10-1', 'nt-22-1']);
    const names = attachments.map((file) => file.filename);

    expect(names.some((name) => name.includes('Puzzi 10/1'.replace('/', '')))).toBe(true);
    expect(names).toContain('Klauzula informacyjna RODO.pdf');
    expect(attachments.every((file) => file.content.length > 1000)).toBe(true);
    // Każdy załącznik musi być prawdziwym PDF-em.
    expect(attachments.every((file) => file.content.subarray(0, 5).toString('ascii') === '%PDF-')).toBe(true);
  });

  it('nie powiela instrukcji przy dwóch sztukach tego samego sprzętu', async () => {
    const { collectRentalAttachments } = await import('../src/rental-attachments.js');

    const attachments = await collectRentalAttachments(['puzzi-10-1', 'puzzi-10-1']);
    expect(attachments).toHaveLength(2); // instrukcja + RODO
  });
});
