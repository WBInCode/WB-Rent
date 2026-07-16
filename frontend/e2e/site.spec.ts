import { test, expect, type Page } from '@playwright/test';

// API is mocked - e2e covers the frontend flow without a live backend/DB.
const mockApi = async (page: Page) => {
  await page.route('**/api/products/availability', (route) =>
    route.fulfill({
      json: { success: true, date: '2026-08-01', availability: {}, reservedCount: 0, totalProducts: 11 },
    })
  );
  await page.route('**/api/payments/config', (route) =>
    route.fulfill({ json: { success: true, enabled: false, provider: null } })
  );
  await page.route('**/api/reservations/product/**', (route) =>
    route.fulfill({ json: { success: true, productId: 'x', blockedDates: [] } })
  );
  await page.route('**/api/reservations/check-availability**', (route) =>
    route.fulfill({ json: { success: true, available: true, conflicts: [] } })
  );
};

test.beforeEach(async ({ page }) => {
  await mockApi(page);
});

test('strona główna renderuje hero i nawigację', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Sprzęt czyszczący');
  await expect(page.getByRole('button', { name: 'Rezerwuj online' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Główna nawigacja' }).getByText('Wkrótce')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Wyślij wiadomość' })).toHaveCount(0);
});

test('kontakt jest osobną podstroną i wysyła formularz', async ({ page }) => {
  let payload: Record<string, unknown> | null = null;
  await page.route('**/api/contact', async (route) => {
    payload = route.request().postDataJSON();
    await route.fulfill({
      status: 201,
      json: { success: true, id: 5, message: 'Wiadomość wysłana!' },
    });
  });

  await page.goto('/');
  await page.getByRole('button', { name: 'Skontaktuj się' }).click();
  await expect(page).toHaveURL(/\/kontakt$/);
  await expect(page.getByRole('heading', { name: 'Porozmawiajmy o Twoim wynajmie' })).toBeVisible();

  await page.getByLabel(/^Imię/).fill('Jan Testowy');
  await page.getByLabel(/^Email/).fill('jan@test.pl');
  await page.getByLabel(/^Wiadomość/).fill('Proszę o kontakt w sprawie wynajmu odkurzacza.');
  await page.getByRole('button', { name: 'Wyślij wiadomość' }).click();

  await expect(page.getByRole('heading', { name: 'Wiadomość wysłana!' })).toBeVisible();
  expect(payload).not.toBeNull();
  expect(payload!.email).toBe('jan@test.pl');
});

test('nieistniejąca ścieżka pokazuje stronę 404', async ({ page }) => {
  await page.goto('/taka-strona-nie-istnieje');
  await expect(page.getByText('404')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Strona nie istnieje' })).toBeVisible();
});

test('strona produktu pokazuje cennik i JSON-LD', async ({ page }) => {
  await page.goto('/produkt/puzzi-10-1');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Puzzi 10/1');
  await expect(page).toHaveTitle(/Puzzi 10\/1/);
  const jsonLd = await page
    .locator('script[type="application/ld+json"]')
    .allTextContents();
  expect(jsonLd.some((s) => s.includes('"@type":"Product"'))).toBe(true);
});

test('flow rezerwacji: wypełnienie formularza i wysyłka (mock API)', async ({ page }) => {
  let submittedPayload: Record<string, unknown> | null = null;

  await page.route('**/api/reservations', (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    submittedPayload = route.request().postDataJSON();
    return route.fulfill({
      status: 201,
      json: {
        success: true,
        message: 'Rezerwacja złożona!',
        id: 123,
        payment: null,
        summary: { productName: 'Test', days: 2, basePrice: 90, deliveryFee: 0, totalPrice: 90 },
      },
    });
  });

  await page.goto('/');
  await page.getByRole('button', { name: 'Rezerwuj online' }).click();
  const reservation = page.locator('#rezerwacja');
  await expect(reservation).toBeVisible({ timeout: 15_000 });

  // Krok 1: kategoria + urządzenie (custom Select = button + lista)
  await reservation.locator('button#kategoria').click();
  await page.getByRole('button', { name: 'Odkurzacze piorące' }).first().click({ force: true });
  await reservation.locator('button#urządzenie').click();
  await page.getByRole('button', { name: /Puzzi 10\/1/ }).first().click({ force: true });

  // Krok 2: daty (DatePicker - wybieramy pierwszy dostępny dzień)
  const pickDate = async (label: string) => {
    await reservation.getByRole('button', { name: label }).click();
    const dialog = page.locator('.fixed.p-4.rounded-2xl').last();
    await dialog
      .locator('button:not([disabled])')
      .filter({ hasText: /^\d{1,2}$/ })
      .first()
      .click({ force: true });
  };
  await pickDate('Data odbioru');
  await pickDate('Data zwrotu');

  // Krok 3: dane kontaktowe
  await reservation.getByLabel('Imię', { exact: false }).fill('Jan');
  await reservation.getByLabel('Nazwisko', { exact: false }).fill('Testowy');
  await reservation.getByLabel('Email', { exact: false }).fill('jan@test.pl');
  await reservation.getByLabel('Telefon', { exact: false }).fill('600100200');

  // Zgody
  const checkboxes = page.locator('#rezerwacja input[type="checkbox"]');
  const count = await checkboxes.count();
  for (let i = 0; i < count; i++) {
    const cb = checkboxes.nth(i);
    if (!(await cb.isChecked())) await cb.check({ force: true });
  }

  // Wyślij
  await reservation.getByRole('button', { name: /Wyślij rezerwację/ }).click();

  // Sukces
  await expect(page.getByText(/Rezerwacja złożona|Dziękujemy/i).first()).toBeVisible({ timeout: 10_000 });
  expect(submittedPayload).not.toBeNull();
  expect(submittedPayload!.email).toBe('jan@test.pl');
  expect(submittedPayload!.productId).toBe('puzzi-10-1');
});

test('moje rezerwacje: formularz prośby o link + lista z tokenem (mock)', async ({ page }) => {
  await page.route('**/api/my-reservations/request-link', (route) =>
    route.fulfill({ json: { success: true, message: 'Link wysłany (mock).' } })
  );
  await page.route('**/api/my-reservations?token=**', (route) =>
    route.fulfill({
      json: {
        success: true,
        email: 'jan@test.pl',
        data: [
          {
            id: 7,
            product_id: 'puzzi-10-1',
            productName: 'Odkurzacz Piorący Kärcher Puzzi 10/1',
            start_date: '2026-09-10',
            end_date: '2026-09-12',
            status: 'confirmed',
            days: 2,
            total_price: 90,
            delivery: 0,
            created_at: '2026-09-01T10:00:00Z',
            payment_status: 'paid',
          },
        ],
      },
    })
  );

  // Bez tokenu: formularz e-mail
  await page.goto('/moje-rezerwacje');
  await page.getByLabel('Adres e-mail').fill('jan@test.pl');
  await page.getByRole('button', { name: /Wyślij link/ }).click();
  await expect(page.getByText('Sprawdź skrzynkę')).toBeVisible();

  // Z tokenem: lista rezerwacji
  await page.goto('/moje-rezerwacje?token=mock-token');
  await expect(page.getByText('jan@test.pl').first()).toBeVisible();
  await expect(page.getByText(/Puzzi 10\/1/)).toBeVisible();
  await expect(page.getByText('✓ Opłacona')).toBeVisible();
  await expect(page.getByText('Potwierdzona')).toBeVisible();
});

test('umowa najmu: pełna treść, podpis odręczny i zapis (tablet flow)', async ({ page }) => {
  const snapshot = {
    contractNumber: 'WB-R/2026/000007',
    templateVersion: '1.0.0',
    generatedAt: '2026-08-01T08:00:00.000Z',
    lessor: {
      name: 'WB Partners Sp. z o.o.',
      address: 'ul. Juliusza Słowackiego 24/11, 35-060 Rzeszów',
      nip: '5170455185',
      representative: 'Anna Pracownik',
    },
    renter: {
      name: 'Jan Testowy',
      email: 'jan@test.pl',
      phone: '600100200',
      address: 'ul. Testowa 1, Rzeszów',
      documentType: 'dowod_osobisty',
      documentNumber: 'ABC 123456',
      pesel: '90010112345',
    },
    rental: {
      reservationId: 7,
      productId: 'puzzi-10-1',
      productName: 'Odkurzacz Piorący Kärcher Puzzi 10/1',
      startDate: '2026-09-10',
      endDate: '2026-09-12',
      startTime: '09:00',
      endTime: '09:00',
      days: 2,
      totalPrice: 90,
      deposit: 300,
      delivery: false,
      accessories: 'Wąż, ssawka, środek czyszczący',
      conditionNotes: 'Sprzęt sprawny i kompletny',
    },
    clauses: Array.from({ length: 9 }, (_, index) => ({
      number: index + 1,
      title: `Paragraf ${index + 1}`,
      text: 'Klient zapoznał się z warunkami najmu, zasadami bezpieczeństwa i odpowiedzialnością za sprzęt.',
    })),
  };

  let submittedSignature = '';
  await page.route('**/api/contracts/sign/mock-contract', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        json: { success: true, id: 1, status: 'ready', contentHash: 'a'.repeat(64), snapshot },
      });
      return;
    }
    const body = route.request().postDataJSON() as { signature: string; accepted: boolean };
    submittedSignature = body.signature;
    expect(body.accepted).toBe(true);
    await route.fulfill({
      json: {
        success: true,
        contractNumber: snapshot.contractNumber,
        pdfHash: 'b'.repeat(64),
        pdfUrl: '/api/contracts/sign/mock-contract/pdf',
        payment: null,
      },
    });
  });

  await page.goto('/podpis/mock-contract');
  await expect(page.getByRole('heading', { name: 'UMOWA NAJMU SPRZĘTU' })).toBeVisible();
  await expect(page.getByText('Jan Testowy').first()).toBeVisible();
  await expect(page.getByText('Odkurzacz Piorący Kärcher Puzzi 10/1')).toBeVisible();

  const signButton = page.getByRole('button', { name: 'Podpisuję umowę' });
  await signButton.scrollIntoViewIfNeeded();

  const canvas = page.getByLabel('Pole podpisu odręcznego');
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  if (box) {
    await page.mouse.move(box.x + 50, box.y + 110);
    await page.mouse.down();
    await page.mouse.move(box.x + 120, box.y + 50, { steps: 8 });
    await page.mouse.move(box.x + 190, box.y + 125, { steps: 8 });
    await page.mouse.move(box.x + 270, box.y + 65, { steps: 8 });
    await page.mouse.up();
  }

  await page.getByRole('checkbox').check();
  await expect(signButton).toBeEnabled();
  await signButton.click();

  await expect(page.getByRole('heading', { name: 'Umowa została podpisana' })).toBeVisible();
  expect(submittedSignature).toMatch(/^data:image\/png;base64,/);
  expect(submittedSignature.length).toBeGreaterThan(500);
});

test('pracownik: klient z ulicy -> rezerwacja -> gotowa sesja umowy', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('wb-rent-admin-token', 'mock-admin-token');
    localStorage.setItem('wb-rent-admin-token-exp', String(Date.now() + 60 * 60 * 1000));
  });

  let reservationPayload: Record<string, unknown> | null = null;
  let contractPayload: Record<string, unknown> | null = null;
  await page.route('**/api/reservations', async (route) => {
    reservationPayload = route.request().postDataJSON();
    await route.fulfill({
      status: 201,
      json: { success: true, id: 77, payment: null, message: 'Rezerwacja utworzona' },
    });
  });
  await page.route('**/api/admin/contracts', async (route) => {
    contractPayload = route.request().postDataJSON();
    await route.fulfill({
      status: 201,
      json: {
        success: true,
        data: {
          id: 12,
          contractNumber: 'WB-R/2026/000077',
          signingUrl: 'http://localhost:5173/podpis/staff-mock-token',
          token: 'staff-mock-token',
          expiresAt: '2026-09-10T12:00:00.000Z',
        },
      },
    });
  });

  await page.goto('/admin/nowy-wynajem');
  await expect(page.getByRole('heading', { name: 'Nowy wynajem i umowa' })).toBeVisible();

  await page.locator('button#urządzenie').click();
  await page.getByRole('button', { name: /Puzzi 10\/1/ }).first().click({ force: true });
  await page.getByLabel(/^Imię/).fill('Jan');
  await page.getByLabel(/^Nazwisko/).fill('Testowy');
  await page.getByLabel(/^E-mail/).fill('jan@test.pl');
  await page.getByLabel(/^Telefon/).fill('600100200');
  await page.getByLabel('Adres zamieszkania').fill('ul. Testowa 1, Rzeszów');
  await page.getByLabel('Numer dokumentu').fill('ABC 123456');
  await page.getByLabel('PESEL (opcjonalnie)').fill('90010112345');
  await page.getByLabel('Pracownik wydający').fill('Anna Pracownik');

  await page.getByRole('button', { name: 'Utwórz i przejdź do podpisu' }).click();

  await expect(page.getByRole('heading', { name: 'Wynajem i umowa gotowe' })).toBeVisible();
  expect(reservationPayload).not.toBeNull();
  expect(reservationPayload!.email).toBe('jan@test.pl');
  expect(contractPayload).not.toBeNull();
  expect(contractPayload!.reservationId).toBe(77);
  expect(contractPayload!.documentNumber).toBe('ABC 123456');
});
