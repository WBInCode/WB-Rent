import { test, expect, type Page } from '@playwright/test';

// API is mocked - e2e covers the frontend flow without a live backend/DB.
const mockApi = async (page: Page) => {
  await page.route('**/api/products', (route) =>
    route.fulfill({ json: { success: true, products: [] } })
  );
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

test('strona główna renderuje hero i prowadzi do podstron', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Sprzęt czyszczący');
  await expect(page.getByRole('link', { name: 'Zarezerwuj sprzęt' }).first()).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Główna nawigacja' }).getByText('Wkrótce')).toHaveCount(0);
  // Formularze mieszkają teraz na dedykowanych podstronach, nie na stronie głównej.
  await expect(page.getByRole('button', { name: 'Wyślij wiadomość' })).toHaveCount(0);
  await expect(page.locator('#rezerwacja')).toHaveCount(0);

  await page.getByRole('navigation', { name: 'Główna nawigacja' })
    .getByRole('link', { name: 'Sprzęt i cennik' }).click();
  await expect(page).toHaveURL(/\/sprzet$/);
  await expect(page.locator('#produkty')).toBeVisible();
});

test('stare kotwice przekierowują na nowe podstrony', async ({ page }) => {
  await page.goto('/#rezerwacja');
  await expect(page).toHaveURL(/\/rezerwacja$/);

  await page.goto('/#produkty');
  await expect(page).toHaveURL(/\/sprzet$/);

  await page.goto('/#faq');
  await expect(page).toHaveURL(/\/jak-to-dziala$/);
});

test('wybór ze strony produktu trafia do formularza na innej podstronie', async ({ page }) => {
  await page.goto('/produkt/puzzi-10-1');
  await page.getByRole('button', { name: /Zarezerwuj/i }).first().click();

  await expect(page).toHaveURL(/\/rezerwacja$/);
  const reservation = page.locator('#rezerwacja');
  await expect(reservation).toBeVisible({ timeout: 15_000 });
  // Prefill must survive the navigation - the provider lives above the router.
  await expect(reservation.locator('button#urządzenie')).toContainText('Puzzi 10/1');
});

test('kategorie na stronie głównej filtrują sprzęt', async ({ page }) => {
  await page.goto('/');
  const categoryLink = page.getByRole('link', { name: /Zobacz wszystkie: Ozonatory/ });
  await categoryLink.scrollIntoViewIfNeeded();
  await expect(categoryLink).toHaveAttribute('href', '/sprzet?kategoria=ozonatory');

  await page.goto('/sprzet?kategoria=ozonatory');
  const activeTab = page.getByRole('tab', { selected: true });
  await expect(activeTab).toContainText('Ozonatory');
  await expect(page.locator('#products-grid > *')).toHaveCount(2);

  // Klik w filtr musi odłożyć wybór w adresie, żeby dało się go udostępnić.
  await page.getByRole('tab', { name: /Wszystkie/ }).dispatchEvent('click');
  await expect(page).toHaveURL(/\/sprzet$/);
  await expect(page.locator('#products-grid > *')).toHaveCount(11);
});

test('karuzela sprzętu przewija się na stronie głównej', async ({ page }) => {
  await page.goto('/');
  const track = page.locator('.carousel-track');
  await track.scrollIntoViewIfNeeded();
  await expect(track.locator('> li')).toHaveCount(11);

  const startOffset = await track.evaluate((el) => el.scrollLeft);
  await page.getByRole('button', { name: 'Następny sprzęt' }).dispatchEvent('click');
  await expect
    .poll(() => track.evaluate((el) => el.scrollLeft))
    .toBeGreaterThan(startOffset);
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

test('motyw jasny/ciemny: przełącza się, utrwala i nie miga przy starcie', async ({ page }) => {
  await page.goto('/');

  // The inline bootstrap must set the palette before React renders (no FOUC).
  const initial = await page.locator('html').getAttribute('data-theme');
  expect(['light', 'dark']).toContain(initial);

  const toggle = page.getByRole('switch').first();
  await expect(toggle).toBeVisible();

  await toggle.click();
  const switched = initial === 'dark' ? 'light' : 'dark';
  await expect(page.locator('html')).toHaveAttribute('data-theme', switched);
  expect(await page.evaluate(() => localStorage.getItem('wb-rent-theme'))).toBe(switched);

  // The choice survives a reload and is applied before first paint.
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', switched);

  // Palette tokens really follow the theme rather than staying hardcoded.
  const card = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--color-bg-card').trim()
  );
  expect(card).toBe(switched === 'light' ? '#ffffff' : '#1a1a1a');
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

test('mobile: dropdown i kalendarz kalkulatora mieszczą się w viewportcie', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto('/');

  const category = page.locator('button#kategoria').first();
  await category.scrollIntoViewIfNeeded();
  await category.click();
  const categoryOption = page.getByRole('button', { name: 'Odkurzacze piorące' }).first();
  const selectBox = await categoryOption.boundingBox();
  expect(selectBox).not.toBeNull();
  expect(selectBox!.x).toBeGreaterThanOrEqual(0);
  expect(selectBox!.x + selectBox!.width).toBeLessThanOrEqual(320);
  await categoryOption.click();

  const startDate = page.getByRole('button', { name: 'Data rozpoczęcia' }).first();
  await startDate.click();
  const calendar = page.locator('body > div.fixed').last();
  const calendarBox = await calendar.boundingBox();
  expect(calendarBox).not.toBeNull();
  expect(calendarBox!.x).toBeGreaterThanOrEqual(0);
  expect(calendarBox!.x + calendarBox!.width).toBeLessThanOrEqual(320);
  await expect(page.locator('html')).not.toHaveCSS('overflow-x', 'scroll');
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

  await page.goto('/rezerwacja');
  const reservation = page.locator('#rezerwacja');
  await expect(reservation).toBeVisible({ timeout: 15_000 });
  await reservation.evaluate((element) => element.scrollIntoView({ behavior: 'instant', block: 'start' }));
  await page.evaluate(() => document.getAnimations().forEach((animation) => {
    const endTime = animation.effect?.getComputedTiming().endTime;
    if (typeof endTime === 'number' && Number.isFinite(endTime)) animation.finish();
  }));

  // Krok 1: kategoria + urządzenie (custom Select = button + lista)
  await reservation.locator('button#kategoria').click({ force: true });
  const categoryOption = page.getByRole('button', { name: 'Odkurzacze piorące' }).first();
  await expect(categoryOption).toBeVisible();
  await categoryOption.click({ force: true });
  await reservation.locator('button#urządzenie').click({ force: true });
  const productOption = page.getByRole('button', { name: /Puzzi 10\/1/ }).first();
  await expect(productOption).toBeVisible();
  await productOption.click({ force: true });

  // Krok 2: daty (DatePicker - wybieramy pierwszy dostępny dzień)
  const pickDate = async (label: string) => {
    await reservation.getByRole('button', { name: label }).click({ force: true });
    const dialog = page.locator('body > div.fixed').last();
    await dialog
      .locator('button:not([disabled])')
      .filter({ hasText: /^\d{1,2}$/ })
      .first()
      .dispatchEvent('click');
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

  await expect(reservation.getByText('Termin dostępny!')).toBeVisible({ timeout: 5_000 });

  // Wyślij
  const reservationResponse = page.waitForResponse(
    (response) => response.url().endsWith('/api/reservations') && response.request().method() === 'POST'
  );
  await reservation.getByRole('button', { name: /Wyślij rezerwację/ }).click();
  expect((await reservationResponse).status()).toBe(201);
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
  await expect(page.getByText('Opłacona', { exact: true })).toBeVisible();
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

  let submittedRenterSignature = '';
  let submittedLessorSignature = '';
  await page.route('**/api/contracts/sign/mock-contract', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        json: { success: true, id: 1, status: 'ready', contentHash: 'a'.repeat(64), snapshot },
      });
      return;
    }
    const body = route.request().postDataJSON() as {
      renterSignature: string;
      lessorSignature: string;
      accepted: boolean;
    };
    submittedRenterSignature = body.renterSignature;
    submittedLessorSignature = body.lessorSignature;
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

  const drawSignature = async (label: string) => {
    const canvas = page.getByLabel(label);
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    if (!box) return;
    await page.mouse.move(box.x + 40, box.y + 90);
    await page.mouse.down();
    await page.mouse.move(box.x + 100, box.y + 35, { steps: 8 });
    await page.mouse.move(box.x + 155, box.y + 105, { steps: 8 });
    await page.mouse.move(box.x + 220, box.y + 45, { steps: 8 });
    await page.mouse.up();
  };
  await drawSignature('Pole podpisu Wynajmującego');
  await drawSignature('Pole podpisu Najemcy');

  await page.getByRole('checkbox').check();
  await expect(signButton).toBeEnabled();
  await signButton.click();

  await expect(page.getByRole('heading', { name: 'Umowa została podpisana' })).toBeVisible();
  expect(submittedRenterSignature).toMatch(/^data:image\/png;base64,/);
  expect(submittedLessorSignature).toMatch(/^data:image\/png;base64,/);
  expect(submittedRenterSignature.length).toBeGreaterThan(500);
  expect(submittedLessorSignature.length).toBeGreaterThan(500);
});

test('mobile: podpis umowy da się dokończyć na małym telefonie', async ({ page }) => {
  // 375x667 - przy progu 60% wysokości sekcji podpisów zgoda nigdy się nie odblokowywała.
  await page.setViewportSize({ width: 375, height: 667 });

  const snapshot = {
    contractNumber: 'WB-R/2026/000042',
    templateVersion: '2.0.0',
    generatedAt: '2026-08-01T08:00:00.000Z',
    lessor: { name: 'WB Partners Sp. z o.o.', address: 'ul. Słowackiego 24/11', nip: '5170455185', representative: 'Anna Pracownik' },
    renter: {
      name: 'Jan Testowy', email: 'jan@test.pl', phone: '600100200', address: 'ul. Testowa 1',
      documentType: 'dowod_osobisty', documentNumber: '', pesel: '90010112345',
    },
    rental: {
      reservationId: 42, productId: 'puzzi-10-1', productName: 'Odkurzacz Piorący Kärcher Puzzi 10/1',
      startDate: '2026-09-10', endDate: '2026-09-12', isIndefinite: false,
      startTime: '09:00', endTime: '09:00', days: 2, totalPrice: 90, deposit: 0,
      delivery: false, accessories: 'Wąż, ssawka', conditionNotes: 'Sprzęt sprawny',
    },
    clauses: Array.from({ length: 12 }, (_, index) => ({
      number: index === 2 ? '2a' : String(index + 1),
      title: `Paragraf ${index + 1}`,
      points: ['Treść pierwszego ustępu. '.repeat(12), 'Treść drugiego ustępu. '.repeat(12)],
    })),
    handoverItems: ['Odkurzacz Kärcher Puzzi 10/1', 'Wąż spryskująco-odsysający'],
  };

  await page.route('**/api/contracts/sign/**', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({ json: { success: true, id: 1, status: 'ready', contentHash: 'a'.repeat(64), snapshot } });
      return;
    }
    await route.fulfill({
      json: { success: true, contractNumber: snapshot.contractNumber, pdfHash: 'b'.repeat(64), pdfUrl: '/x', payment: null },
    });
  });

  await page.goto('/podpis/mock-mobile');
  await expect(page.getByRole('heading', { name: 'UMOWA NAJMU SPRZĘTU' })).toBeVisible();

  // Brak numeru dokumentu = pozycja w ogóle się nie pojawia.
  await expect(page.getByText('nie odnotowano')).toHaveCount(0);
  await expect(page.getByText('Dokument', { exact: true })).toHaveCount(0);
  // Adres i NIP to osobne pozycje, nie jedna sklejona.
  await expect(page.getByText('NIP', { exact: true })).toBeVisible();
  // Załącznik nr 1 jest widoczny przed podpisem.
  await expect(page.getByText('Załącznik nr 1 — Protokół wydania sprzętu')).toBeVisible();
  await expect(page.getByText('§ 2a. Paragraf 3')).toBeVisible();

  const signButton = page.getByRole('button', { name: 'Podpisuję umowę' });
  await expect(signButton).toBeDisabled();
  await expect(page.getByText(/Aby podpisać umowę:/)).toBeVisible();

  const checkbox = page.getByRole('checkbox');
  await signButton.scrollIntoViewIfNeeded();
  await expect(checkbox).toBeEnabled();

  const drawSignature = async (label: string) => {
    const canvas = page.getByLabel(label);
    // Na 375 px oba pola podpisu nie mieszczą się naraz - trzeba przewinąć do każdego.
    await canvas.scrollIntoViewIfNeeded();
    const box = await canvas.boundingBox();
    if (!box) throw new Error(`Brak pola: ${label}`);
    // Współrzędne względne - na 375 px kanwa jest znacznie węższa niż na desktopie.
    await page.mouse.move(box.x + box.width * 0.15, box.y + box.height * 0.7);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.4, box.y + box.height * 0.25, { steps: 8 });
    await page.mouse.move(box.x + box.width * 0.65, box.y + box.height * 0.75, { steps: 8 });
    await page.mouse.move(box.x + box.width * 0.85, box.y + box.height * 0.3, { steps: 8 });
    await page.mouse.up();
  };
  await drawSignature('Pole podpisu Wynajmującego');
  await drawSignature('Pole podpisu Najemcy');
  await checkbox.check();

  await expect(page.getByText(/Aby podpisać umowę:/)).toHaveCount(0);
  await expect(signButton).toBeEnabled();
  await signButton.click();
  await expect(page.getByRole('heading', { name: 'Umowa została podpisana' })).toBeVisible();
});

test('pracownik: dwa urządzenia -> jedna rezerwacja -> jedna sesja umowy', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('wb-rent-admin-token', 'mock-admin-token');
    localStorage.setItem('wb-rent-admin-token-exp', String(Date.now() + 60 * 60 * 1000));
  });

  let reservationPayload: Record<string, unknown> | null = null;
  let contractPayload: Record<string, unknown> | null = null;
  await page.route('**/api/admin/contracts/handover-template*', (route) =>
    route.fulfill({
      json: {
        success: true,
        data: {
          items: [
            '1) Kärcher Puzzi 10/1 — Odkurzacz Kärcher Puzzi 10/1',
            '1) Kärcher Puzzi 10/1 — Wąż spryskująco-odsysający 2,5 m',
            '2) Kärcher NT 22/1 Ap L — Odkurzacz Kärcher NT 22/1 Ap L',
          ],
        },
      },
    })
  );
  await page.route('**/api/admin/contracts/validate', async (route) => {
    await route.fulfill({ json: { success: true } });
  });
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
  await expect(page.getByRole('heading', { name: 'Nowy wynajem' })).toBeVisible();

  await page.getByRole('button', { name: 'Dodaj Odkurzacz Piorący Kärcher Puzzi 10/1' }).click();
  await page.getByRole('button', { name: 'Dodaj Odkurzacz Przemysłowy Kärcher NT 22/1 AP L' }).click();
  await expect(page.getByText('2 wybranych')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Wybrany zestaw' })).toBeVisible();
  await expect(page.getByText('2 URZĄDZENIA')).toBeVisible();
  await expect(page.getByRole('img', { name: 'Odkurzacz Piorący Kärcher Puzzi 10/1' })).toBeVisible();
  await page.getByLabel(/^Imię/).fill('Jan');
  await page.getByLabel(/^Nazwisko/).fill('Testowy');
  await page.getByLabel(/^E-mail/).fill('jan@test.pl');
  await page.getByLabel(/^Telefon/).fill('600100200');
  await page.getByLabel('Adres zamieszkania').fill('ul. Testowa 1, Rzeszów');
  await page.getByLabel('Numer dokumentu (opcjonalnie)').fill('ABC 123456');
  await page.getByLabel(/^PESEL/).fill('90010112345');
  await page.getByLabel('Pracownik wydający').fill('Anna Pracownik');

  await page.getByRole('button', { name: 'Przejdź do umowy' }).click();

  await expect(page.getByRole('heading', { name: 'Wynajem i umowa gotowe' })).toBeVisible();
  expect(reservationPayload).not.toBeNull();
  expect(reservationPayload!.email).toBe('jan@test.pl');
  expect(reservationPayload!.productIds).toEqual(['puzzi-10-1', 'nt-22-1']);
  expect(contractPayload).not.toBeNull();
  expect(contractPayload!.reservationId).toBe(77);
  expect(contractPayload!.documentNumber).toBe('ABC 123456');
});

test('pracownik: poprawia protokół wydania przed wygenerowaniem podpisu', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('wb-rent-admin-token', 'mock-admin-token');
    localStorage.setItem('wb-rent-admin-token-exp', String(Date.now() + 60 * 60 * 1000));
  });

  let contractPayload: Record<string, unknown> | null = null;
  await page.route('**/api/admin/contracts/handover-template*', (route) =>
    route.fulfill({
      json: {
        success: true,
        data: {
          items: ['Odkurzacz Kärcher Puzzi 10/1', 'Wąż spryskująco-odsysający 2,5 m', 'Ssawka szczelinowa'],
        },
      },
    })
  );
  await page.route('**/api/admin/contracts/validate', (route) => route.fulfill({ json: { success: true } }));
  await page.route('**/api/reservations', (route) =>
    route.fulfill({ status: 201, json: { success: true, id: 55, payment: null, message: 'ok' } })
  );
  await page.route('**/api/admin/contracts', async (route) => {
    contractPayload = route.request().postDataJSON();
    await route.fulfill({
      status: 201,
      json: {
        success: true,
        data: {
          id: 5,
          contractNumber: 'WB-R/2026/000055',
          signingUrl: 'http://localhost:5173/podpis/protokol-mock',
          token: 'protokol-mock',
          expiresAt: '2026-09-10T12:00:00.000Z',
        },
      },
    });
  });

  await page.goto('/admin/nowy-wynajem');
  await page.getByRole('button', { name: 'Dodaj Odkurzacz Piorący Kärcher Puzzi 10/1' }).click();

  // System proponuje protokół z umowy papierowej.
  await expect(page.getByLabel('Pozycja 1 protokołu wydania')).toHaveValue('Odkurzacz Kärcher Puzzi 10/1');
  await expect(page.getByLabel('Pozycja 3 protokołu wydania')).toHaveValue('Ssawka szczelinowa');

  // Klient nie bierze węża - pracownik usuwa pozycję.
  await page.getByRole('button', { name: 'Usuń pozycję 2 protokołu wydania' }).click();
  await expect(page.getByLabel('Pozycja 2 protokołu wydania')).toHaveValue('Ssawka szczelinowa');

  // Doprecyzowanie stanu i dopisanie pozycji spoza listy.
  await page.getByLabel('Pozycja 2 protokołu wydania').fill('Ssawka szczelinowa (rysa na obudowie)');
  await page.getByRole('button', { name: 'Dodaj pozycję' }).click();
  await page.getByLabel('Pozycja 3 protokołu wydania').fill('Przedłużacz 10 m');

  await page.getByLabel(/^Imię/).fill('Jan');
  await page.getByLabel(/^Nazwisko/).fill('Testowy');
  await page.getByLabel(/^E-mail/).fill('jan@test.pl');
  await page.getByLabel(/^Telefon/).fill('600100200');
  await page.getByLabel('Adres zamieszkania').fill('ul. Testowa 1, Rzeszów');
  await page.getByLabel(/^PESEL/).fill('90010112345');
  await page.getByLabel('Pracownik wydający').fill('Anna Pracownik');
  await page.getByRole('button', { name: 'Przejdź do umowy' }).click();

  await expect(page.getByRole('heading', { name: 'Wynajem i umowa gotowe' })).toBeVisible();
  expect(contractPayload!.handoverItems).toEqual([
    'Odkurzacz Kärcher Puzzi 10/1',
    'Ssawka szczelinowa (rysa na obudowie)',
    'Przedłużacz 10 m',
  ]);
});

test('mobile: braki w danych klienta nie tworzą rezerwacji i przenoszą fokus na pole', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.addInitScript(() => {
    localStorage.setItem('wb-rent-admin-token', 'mock-admin-token');
    localStorage.setItem('wb-rent-admin-token-exp', String(Date.now() + 60 * 60 * 1000));
  });

  let liczbaWywolanRezerwacji = 0;
  await page.route('**/api/admin/contracts/validate', (route) => route.fulfill({ json: { success: true } }));
  await page.route('**/api/reservations', async (route) => {
    liczbaWywolanRezerwacji += 1;
    await route.fulfill({ status: 201, json: { success: true, id: 99, payment: null, message: 'ok' } });
  });

  await page.goto('/admin/nowy-wynajem');
  await page.getByRole('button', { name: 'Dodaj Odkurzacz Piorący Kärcher Puzzi 10/1' }).click();

  const wyslij = page.getByRole('button', { name: 'Przejdź do umowy' });

  // 1. Zupełnie pusty formularz - pierwsze brakujące pole to imię.
  await wyslij.click();
  await expect(page.getByText('Podaj imię najemcy.')).toBeVisible();
  await expect(page.getByLabel(/^Imię/)).toBeFocused();
  expect(liczbaWywolanRezerwacji).toBe(0);

  // 2. Brak e-maila - bez niego umowa nie ma dokąd trafić.
  await page.getByLabel(/^Imię/).fill('Jan');
  await page.getByLabel(/^Nazwisko/).fill('Testowy');
  await wyslij.click();
  await expect(page.getByText('Podaj poprawny adres e-mail — na niego trafi podpisana umowa.')).toBeVisible();
  await expect(page.getByLabel(/^E-mail/)).toBeFocused();
  expect(liczbaWywolanRezerwacji).toBe(0);

  // 3. Za krótki telefon.
  await page.getByLabel(/^E-mail/).fill('jan@test.pl');
  await page.getByLabel(/^Telefon/).fill('600');
  await wyslij.click();
  await expect(page.getByText('Podaj numer telefonu (minimum 9 cyfr).')).toBeVisible();
  await expect(page.getByLabel(/^Telefon/)).toBeFocused();
  expect(liczbaWywolanRezerwacji).toBe(0);
});

test('pracownik: ustala własną cenę, rabat i kod rabatowy', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('wb-rent-admin-token', 'mock-admin-token');
    localStorage.setItem('wb-rent-admin-token-exp', String(Date.now() + 60 * 60 * 1000));
  });

  let reservationPayload: Record<string, unknown> | null = null;
  let authHeader: string | undefined;
  await page.route('**/api/admin/contracts/handover-template*', (route) =>
    route.fulfill({ json: { success: true, data: { items: ['Odkurzacz Kärcher Puzzi 10/1', 'Wąż spryskująco-odsysający 2,5 m'] } } })
  );
  await page.route('**/api/admin/contracts/validate', (route) => route.fulfill({ json: { success: true } }));
  await page.route('**/api/reservations', async (route) => {
    reservationPayload = route.request().postDataJSON();
    authHeader = route.request().headers()['authorization'];
    await route.fulfill({ status: 201, json: { success: true, id: 91, payment: null, message: 'ok' } });
  });
  await page.route('**/api/admin/contracts', (route) =>
    route.fulfill({
      status: 201,
      json: {
        success: true,
        data: {
          id: 5,
          contractNumber: 'WB-R/2026/000091',
          signingUrl: 'http://localhost:5173/podpis/tok',
          token: 'tok',
          expiresAt: '2026-09-10T12:00:00.000Z',
        },
      },
    })
  );
  await page.route('**/api/admin/reservations/91/photos', (route) =>
    route.fulfill({ json: { success: true, data: [] } })
  );

  await page.goto('/admin/nowy-wynajem');
  await page.getByRole('button', { name: 'Dodaj Odkurzacz Piorący Kärcher Puzzi 10/1' }).click();

  await page.getByLabel(/^Imię/).fill('Jan');
  await page.getByLabel(/^Nazwisko/).fill('Testowy');
  await page.getByLabel(/^E-mail/).fill('jan@test.pl');
  await page.getByLabel(/^Telefon/).fill('600100200');
  await page.getByLabel('Adres zamieszkania').fill('ul. Testowa 1, Rzeszów');
  await page.getByLabel(/^PESEL/).fill('90010112345');
  await page.getByLabel('Pracownik wydający').fill('Anna Pracownik');

  await page.getByLabel('Kod rabatowy klienta').fill('wbr-aaaa-bbbb');
  await page.getByLabel('Rabat (zł)').fill('15');
  await page.getByLabel('Cena końcowa (zł)').fill('30');
  await page.getByLabel('Powód zmiany ceny').fill('stały klient');

  // Cena systemowa musi zostać pokazana jako przekreślona obok nowej.
  await expect(page.getByText('cena ustalona ręcznie')).toBeVisible();
  await expect(page.getByText('30 zł', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Przejdź do umowy' }).click();
  await expect(page.getByRole('heading', { name: 'Wynajem i umowa gotowe' })).toBeVisible();

  expect(authHeader).toBe('Bearer mock-admin-token');
  expect(reservationPayload!.couponCode).toBe('WBR-AAAA-BBBB');
  expect(reservationPayload!.staffPricing).toMatchObject({
    priceOverride: 30,
    discountAmount: 15,
    note: 'stały klient',
    setBy: 'Anna Pracownik',
  });

  // Dokumentacja zdjęciowa jest dostępna od razu po utworzeniu wynajmu.
  await expect(page.getByRole('heading', { name: 'Dokumentacja stanu sprzętu' })).toBeVisible();
  await expect(page.getByText('Przed wydaniem', { exact: true })).toBeVisible();
  await expect(page.getByText('Po zwrocie', { exact: true })).toBeVisible();
});

test('pracownik: brak numeru PESEL nie tworzy rezerwacji', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('wb-rent-admin-token', 'mock-admin-token');
    localStorage.setItem('wb-rent-admin-token-exp', String(Date.now() + 60 * 60 * 1000));
  });

  let reservationRequests = 0;
  let validationRequests = 0;
  await page.route('**/api/reservations', async (route) => {
    reservationRequests += 1;
    await route.fulfill({ status: 201, json: { success: true, id: 99 } });
  });
  await page.route('**/api/admin/contracts/validate', async (route) => {
    validationRequests += 1;
    await route.fulfill({ json: { success: true } });
  });

  await page.goto('/admin/nowy-wynajem');
  await page.getByRole('button', { name: 'Dodaj Odkurzacz Piorący Kärcher Puzzi 10/1' }).click();
  await expect(page.getByRole('img', { name: 'Odkurzacz Piorący Kärcher Puzzi 10/1' })).toBeVisible();
  await page.getByLabel(/^Imię/).fill('Jan');
  await page.getByLabel(/^Nazwisko/).fill('Testowy');
  await page.getByLabel(/^E-mail/).fill('jan@test.pl');
  await page.getByLabel(/^Telefon/).fill('600100200');
  await page.getByLabel('Adres zamieszkania').fill('ul. Testowa 1, Rzeszów');
  await page.getByLabel('Pracownik wydający').fill('Anna Pracownik');

  // Numer dokumentu jest teraz opcjonalny - brak wpisu nie może blokować wynajmu.
  await expect(page.getByLabel('Numer dokumentu (opcjonalnie)')).toHaveValue('');

  const pesel = page.getByLabel(/^PESEL/);
  await pesel.fill('123');
  expect(await pesel.evaluate((input: HTMLInputElement) => input.checkValidity())).toBe(false);

  await page.getByRole('button', { name: 'Przejdź do umowy' }).click();

  await expect(page.getByText('PESEL musi składać się dokładnie z 11 cyfr.')).toBeVisible();
  expect(validationRequests).toBe(0);
  expect(reservationRequests).toBe(0);
});

test('pracownik: może wybrać wynajem bezterminowy', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('wb-rent-admin-token', 'mock-admin-token');
    localStorage.setItem('wb-rent-admin-token-exp', String(Date.now() + 60 * 60 * 1000));
  });

  await page.goto('/admin/nowy-wynajem');
  await page.getByRole('button', { name: 'Dodaj Odkurzacz Piorący Kärcher Puzzi 10/1' }).click();
  await page.getByRole('switch', { name: 'Wynajem bezterminowy' }).check();

  await expect(page.getByLabel('Data zwrotu')).toHaveCount(0);
  await expect(page.getByLabel('Godzina zwrotu')).toHaveCount(0);
  await expect(page.getByText('Opłata startowa • 1 doba')).toBeVisible();
  await expect(page.getByText(/Sprzęt pozostanie niedostępny/)).toBeVisible();
});

test('panel admina: ręczny wybór statusu z listy zapisuje audyt', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('wb-rent-admin-token', 'mock-admin-token');
    localStorage.setItem('wb-rent-admin-token-exp', String(Date.now() + 60 * 60 * 1000));
  });

  let statusPayload: Record<string, unknown> | null = null;
  await page.route('**/api/admin/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path.endsWith('/stats')) {
      await route.fulfill({ json: {
        success: true,
        data: {
          reservations: { total: 1, pending: 0, confirmed: 0, picked_up: 1, returned: 0, completed: 0, rejected: 0 },
          contacts: { total: 0, new: 0 },
          revenue: { today: 0, month: 0, total: 0, pending: 60 },
        },
      } });
      return;
    }
    if (path.endsWith('/reservations') && request.method() === 'GET') {
      await route.fulfill({ json: { success: true, data: [{
        id: 77,
        product_id: 'af-100-h13',
        category_id: 'ozonatory',
        start_date: '2026-07-20',
        end_date: '2026-07-21',
        is_indefinite: false,
        start_time: '09:00',
        end_time: '09:00',
        name: 'Jan Testowy',
        email: 'jan@test.pl',
        phone: '600100200',
        city: 'Rzeszów',
        delivery: 0,
        days: 1,
        base_price: 60,
        delivery_fee: 0,
        total_price: 60,
        status: 'picked_up',
        wants_invoice: 0,
        payment_status: 'paid',
        contract_status: 'signed',
        created_at: '2026-07-20T09:00:00Z',
      }] } });
      return;
    }
    if (path.endsWith('/reservations/77/status-changes')) {
      await route.fulfill({ json: { success: true, data: [] } });
      return;
    }
    if (path.endsWith('/reservations/77') && request.method() === 'PATCH') {
      statusPayload = request.postDataJSON();
      await route.fulfill({ json: { success: true, message: 'Status zmieniony na: returned', data: { status: 'returned' } } });
      return;
    }
    if (path.endsWith('/contacts') || path.endsWith('/notifications')) {
      await route.fulfill({ json: { success: true, data: [] } });
      return;
    }
    if (path.endsWith('/revenue')) {
      await route.fulfill({ json: { success: true, data: { today: 0, month: 0, total: 0, pending: 60, byMonth: [] } } });
      return;
    }
    await route.fulfill({ json: { success: true, data: [] } });
  });

  await page.goto('/admin');
  await page.locator('button#reservation-status-77').click();
  const statusDropdown = page.locator('body > div.fixed').last();
  await statusDropdown.evaluate((element) => {
    element.scrollTop = 120;
    element.dispatchEvent(new Event('scroll'));
  });
  await expect(statusDropdown).toBeVisible();
  await expect(page.locator('button#reservation-status-77')).toHaveAttribute('aria-expanded', 'true');
  await statusDropdown.getByRole('button', { name: 'Zwrócone', exact: true }).click();
  const statusModal = page.getByRole('heading', { name: 'Zmień status wynajmu' }).locator('xpath=ancestor::form');
  await expect(statusModal).toBeVisible();
  await expect(statusModal.getByText('Wydane', { exact: true })).toBeVisible();
  await expect(statusModal.locator('span.rounded-full').filter({ hasText: /^Zwrócone$/ })).toBeVisible();
  await page.getByLabel('Pracownik zmieniający status').fill('Anna Pracownik');
  await page.getByLabel('Powód zmiany').fill('Sprzęt przyjęty i sprawdzony');
  await expect(page.getByRole('switch', { name: /Powiadom klienta/ })).toBeChecked();
  await page.getByRole('button', { name: 'Zapisz status' }).click();

  expect(statusPayload).toEqual({
    status: 'returned',
    note: 'Sprzęt przyjęty i sprawdzony',
    changedBy: 'Anna Pracownik',
    notifyCustomer: true,
  });
});

test('panel admina: zdjęcia sprzętu dostępne po zakończeniu wynajmu', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('wb-rent-admin-token', 'mock-admin-token');
    localStorage.setItem('wb-rent-admin-token-exp', String(Date.now() + 60 * 60 * 1000));
  });

  let uploadedPhase: string | null = null;
  await page.route('**/api/admin/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path.endsWith('/stats')) {
      await route.fulfill({ json: {
        success: true,
        data: {
          reservations: { total: 1, pending: 0, confirmed: 0, picked_up: 1, returned: 0, completed: 0, rejected: 0 },
          contacts: { total: 0, new: 0 },
          revenue: { today: 0, month: 0, total: 0, pending: 60 },
        },
      } });
      return;
    }
    if (path.endsWith('/reservations') && request.method() === 'GET') {
      await route.fulfill({ json: { success: true, data: [{
        id: 77,
        product_id: 'puzzi-10-1',
        category_id: 'odkurzacze-piorace',
        start_date: '2026-07-20',
        end_date: '2026-07-21',
        is_indefinite: false,
        start_time: '09:00',
        end_time: '09:00',
        name: 'Jan Testowy',
        email: 'jan@test.pl',
        phone: '600100200',
        city: 'Rzeszów',
        delivery: 0,
        days: 1,
        base_price: 60,
        delivery_fee: 0,
        total_price: 60,
        status: 'picked_up',
        wants_invoice: 0,
        payment_status: 'paid',
        contract_status: 'signed',
        created_at: '2026-07-20T09:00:00Z',
      }] } });
      return;
    }
    if (path.endsWith('/reservations/77/photos') && request.method() === 'POST') {
      uploadedPhase = (request.postData() || '').includes('name="phase"\r\n\r\nafter') ? 'after' : 'before';
      await route.fulfill({ status: 201, json: { success: true, data: { id: 1 }, message: 'Zdjęcie przed wydaniem zapisane' } });
      return;
    }
    await route.fulfill({ json: { success: true, data: [] } });
  });

  await page.goto('/admin');
  await page.getByRole('button', { name: 'Pokaż szczegóły' }).click();

  // Wynajem jest już wydany, a zdjęcia nadal da się dograć z panelu.
  await expect(page.getByText('Zdjęcia stanu sprzętu')).toBeVisible();
  await expect(page.getByText('Przed wydaniem')).toBeVisible();
  await expect(page.getByText('Po zwrocie')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Zrób zdjęcie' })).toHaveCount(2);
  await expect(page.getByRole('button', { name: 'Z galerii' })).toHaveCount(2);

  // Wgranie pliku z dysku zamiast aparatu (tablet bez kamery / zdjęcie zrobione wcześniej).
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64'
  );
  await page.locator('input[type="file"]').first().setInputFiles({
    name: 'stan-sprzetu.png',
    mimeType: 'image/png',
    buffer: png,
  });
  await expect.poll(() => uploadedPhase).toBe('before');
});

test('panel admina: sidebar prowadzi przez wszystkie moduły i działa mobilnie', async ({ page }) => {
  // Szeroki test dymny: 12 modułów + widok mobilny nie mieści się w domyślnym budżecie.
  test.setTimeout(60_000);
  await page.addInitScript(() => {
    localStorage.setItem('wb-rent-admin-token', 'mock-admin-token');
    localStorage.setItem('wb-rent-admin-token-exp', String(Date.now() + 60 * 60 * 1000));
  });
  await page.route('**/api/admin/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/stats')) {
      await route.fulfill({ json: {
        success: true,
        data: {
          reservations: { total: 2, pending: 1, confirmed: 1, picked_up: 0, returned: 0, completed: 0, rejected: 0 },
          contacts: { total: 0, new: 0 },
          revenue: { today: 80, month: 250, total: 500, pending: 80 },
        },
      } });
      return;
    }
    if (path.endsWith('/reservations')) {
      await route.fulfill({ json: { success: true, data: [] } });
      return;
    }
    if (path.endsWith('/contacts')) {
      await route.fulfill({ json: { success: true, data: [] } });
      return;
    }
    if (path.endsWith('/revenue')) {
      await route.fulfill({ json: { success: true, data: { today: 80, month: 250, total: 500, pending: 80, byMonth: [] } } });
      return;
    }
    if (path.includes('/newsletter/subscribers')) {
      await route.fulfill({ json: { success: true, data: [] } });
      return;
    }
    if (path.includes('/newsletter/posts')) {
      await route.fulfill({ json: { success: true, data: [] } });
      return;
    }
    if (path.endsWith('/notifications')) {
      await route.fulfill({ json: { success: true, data: [] } });
      return;
    }
    await route.fulfill({ json: { success: true, data: [] } });
  });

  await page.goto('/admin');
  await expect(page.getByRole('navigation', { name: 'Moduły panelu' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Rezerwacje' })).toBeVisible();

  const views = [
    ['Produkty i magazyn', 'Produkty i magazyn'],
    ['Kalendarz', 'Kalendarz zajętości'],
    ['Przychody', 'Przychody'],
    ['Wiadomości', 'Wiadomości'],
    ['Przypomnienia', 'Przypomnienia'],
    ['Newsletter', 'Newsletter'],
    ['Dostępność', 'Dostępność'],
    ['Rabaty', 'Rabaty'],
    ['Kupony', 'Kupony'],
    ['Dokumenty', 'Dokumenty'],
    ['Dane firmy', 'Dane firmy'],
    ['Ustawienia', 'Ustawienia'],
  ] as const;
  for (const [button, heading] of views) {
    await page.getByRole('button', { name: new RegExp(`^${button}`) }).click();
    await expect(page.getByRole('heading', { name: heading, exact: true }).first()).toBeVisible();
  }

  // Toolbar controls must share one height - a taller select next to a button
  // is the kind of misalignment that makes the panel look unfinished.
  await page.getByRole('button', { name: /^Kupony/ }).click();
  const filterBox = await page.getByRole('button', { name: 'Filtruj kupony' }).boundingBox();
  const generateBox = await page.getByRole('button', { name: /Generuj kupon/ }).boundingBox();
  expect(filterBox?.height).toBe(40);
  expect(generateBox?.height).toBe(40);
  expect(Math.abs((filterBox?.y ?? 0) - (generateBox?.y ?? 0))).toBeLessThan(1);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await page.getByRole('button', { name: 'Otwórz menu' }).click();
  await expect(page.getByRole('navigation', { name: 'Moduły panelu' })).toBeVisible();
  await page.getByRole('button', { name: /^Kalendarz/ }).click();
  await expect(page.getByRole('heading', { name: 'Kalendarz zajętości', exact: true }).first()).toBeVisible();
  await expect(page.locator('html')).not.toHaveCSS('overflow-x', 'scroll');
});

test('panel admina: zarządza ilością i stanem produktu', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('wb-rent-admin-token', 'mock-admin-token');
    localStorage.setItem('wb-rent-admin-token-exp', String(Date.now() + 60 * 60 * 1000));
  });

  let updatedProduct: Record<string, unknown> | null = null;
  const product = {
    id: 'puzzi-10-1',
    name: 'Odkurzacz Piorący Kärcher Puzzi 10/1',
    description: 'Profesjonalny odkurzacz piorący',
    category_id: 'odkurzacze-piorace',
    image: '/products/puzzi-10-1.jpg',
    images: ['/products/puzzi-10-1.jpg'],
    price_per_day: 45,
    price_next_day: 45,
    price_weekend: 150,
    total_quantity: 2,
    service_quantity: 0,
    rentable_quantity: 2,
    reserved_today: 1,
    available_today: 1,
    condition_status: 'good',
    inventory_notes: '',
    is_active: true,
    created_at: '2026-07-21T10:00:00Z',
    updated_at: '2026-07-21T10:00:00Z',
  };

  await page.route('**/api/admin/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path.endsWith('/stats')) {
      await route.fulfill({ json: {
        success: true,
        data: {
          reservations: { total: 1, pending: 0, confirmed: 0, picked_up: 1, returned: 0, completed: 0, rejected: 0 },
          contacts: { total: 0, new: 0 },
          revenue: { today: 0, month: 0, total: 0, pending: 0 },
        },
      } });
      return;
    }
    if (path.endsWith('/products') && request.method() === 'GET') {
      await route.fulfill({ json: { success: true, data: [product] } });
      return;
    }
    if (path.endsWith('/products/puzzi-10-1') && request.method() === 'PUT') {
      updatedProduct = request.postDataJSON();
      await route.fulfill({ json: { success: true, data: { ...product, total_quantity: 3 }, message: 'Produkt został zapisany' } });
      return;
    }
    if (path.endsWith('/revenue')) {
      await route.fulfill({ json: { success: true, data: { today: 0, month: 0, total: 0, pending: 0, byMonth: [] } } });
      return;
    }
    await route.fulfill({ json: { success: true, data: [] } });
  });

  await page.goto('/admin');
  await page.getByRole('button', { name: /^Produkty i magazyn/ }).click();
  await expect(page.getByText('1 dostępne')).toBeVisible();
  await expect(page.getByText('1 wynajęte · 0 serwis')).toBeVisible();

  await page.getByRole('button', { name: /Edytuj Odkurzacz Piorący/ }).click();
  await page.getByLabel('Ilość całkowita').fill('3');
  await page.getByLabel('Adres zdjęcia').fill('/products/puzzi-10-1-bok.jpg');
  await page.getByRole('button', { name: 'Dodaj adres' }).click();
  await page.getByRole('button', { name: 'Ustaw zdjęcie 2 jako główne' }).click();
  await page.getByRole('button', { name: 'Zapisz produkt' }).click();

  expect(updatedProduct).not.toBeNull();
  expect(updatedProduct!.id).toBe('puzzi-10-1');
  expect(updatedProduct!.totalQuantity).toBe(3);
  expect(updatedProduct!.conditionStatus).toBe('good');
  expect(updatedProduct!.image).toBe('/products/puzzi-10-1-bok.jpg');
  expect(updatedProduct!.images).toEqual(['/products/puzzi-10-1-bok.jpg', '/products/puzzi-10-1.jpg']);

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('html')).not.toHaveCSS('overflow-x', 'scroll');
});
