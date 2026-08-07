import { describe, expect, it } from 'vitest';

process.env.NODE_ENV = 'test';

const { availableActions, canTransition, canPrepareHandover, canPrepareReturn, ACTION_TARGET_STATUS, czyMoznaZamknacAutomatycznie } =
  await import('../src/reservation-transitions.js');

const bezZdjec = { returnPhotos: 0 };
const zeZdjeciami = { returnPhotos: 2 };
/** Wydanie wymaga podpisanego protokołu i zdjęć sprzętu. */
const gotoweDoWydania = { returnPhotos: 0, handoverPhotos: 2, handoverProtocolSigned: true };
/** Zwrot też: podpisany protokoł zwrotu i zdjęcia po najmie. */
const gotoweDoZwrotu = { returnPhotos: 2, returnProtocolSigned: true };

const wynajem = (nadpisz: Record<string, unknown> = {}) => ({
  status: 'pending',
  payment_status: 'unpaid',
  contract_status: 'not_prepared',
  start_date: '2026-08-10',
  start_time: '09:00',
  end_date: '2026-08-15',
  end_time: '09:00',
  is_indefinite: false,
  ...nadpisz,
});

const akcje = (r: any, ctx = bezZdjec) =>
  availableActions(r, ctx).filter((a) => a.available).map((a) => a.action);

describe('akcje dostepne w danym momencie', () => {
  it('zapytanie mozna potwierdzic, odrzucic albo anulowac', () => {
    expect(akcje(wynajem()).sort()).toEqual(['cancel', 'confirm', 'reject']);
  });

  it('zapytania nie mozna od razu wydac ani zwrocic', () => {
    expect(akcje(wynajem())).not.toContain('hand_over');
    expect(akcje(wynajem())).not.toContain('register_return');
    expect(akcje(wynajem())).not.toContain('complete');
  });

  it('bez podpisanej umowy wydanie jest zablokowane z powodem', () => {
    const wydanie = availableActions(wynajem({ status: 'confirmed', contract_status: 'ready' }), bezZdjec)
      .find((a) => a.action === 'hand_over');
    expect(wydanie?.available).toBe(false);
    expect(wydanie?.reason).toBe('Klient nie podpisał jeszcze umowy');
  });

  it('podpisana ale nieoplacona blokuje wydanie z innym powodem', () => {
    const wydanie = availableActions(wynajem({ status: 'confirmed', contract_status: 'signed' }), bezZdjec)
      .find((a) => a.action === 'hand_over');
    expect(wydanie?.available).toBe(false);
    expect(wydanie?.reason).toBe('Rezerwacja nie została opłacona');
  });

  it('podpisana i oplacona pozwala przygotowac protokol wydania', () => {
    const r = wynajem({ status: 'confirmed', contract_status: 'signed', payment_status: 'paid' });
    expect(canPrepareHandover(r).ok).toBe(true);
  });

  it('bez podpisanego protokolu wydanie jest zablokowane', () => {
    const r = wynajem({ status: 'confirmed', contract_status: 'signed', payment_status: 'paid' });
    const wydanie = availableActions(r, { returnPhotos: 0, handoverPhotos: 3, handoverProtocolSigned: false })
      .find((a) => a.action === 'hand_over');
    expect(wydanie?.available).toBe(false);
    expect(wydanie?.reason).toBe('Podpiszcie protokół wydania');
  });

  it('z podpisanym protokolem ale bez zdjec wydanie nadal zablokowane', () => {
    const r = wynajem({ status: 'confirmed', contract_status: 'signed', payment_status: 'paid' });
    const wydanie = availableActions(r, { returnPhotos: 0, handoverPhotos: 0, handoverProtocolSigned: true })
      .find((a) => a.action === 'hand_over');
    expect(wydanie?.available).toBe(false);
    expect(wydanie?.reason).toBe('Dodaj zdjęcia wydawanego sprzętu');
  });

  it('protokol i zdjecia razem pozwalaja wydac sprzet', () => {
    const r = wynajem({ status: 'confirmed', contract_status: 'signed', payment_status: 'paid' });
    expect(akcje(r, gotoweDoWydania)).toContain('hand_over');
  });

  it('przed podpisaniem umowy nie da sie nawet przygotowac protokolu', () => {
    const r = wynajem({ status: 'confirmed', contract_status: 'ready' });
    expect(canPrepareHandover(r).ok).toBe(false);
    expect(canPrepareHandover(r).reason).toBe('Klient nie podpisał jeszcze umowy');
  });

  it('u klienta bez podpisanego protokolu nie mozna przyjac zwrotu', () => {
    const r = wynajem({ status: 'picked_up', contract_status: 'signed', payment_status: 'paid' });
    const zwrot = availableActions(r, zeZdjeciami).find((a) => a.action === 'register_return');
    expect(zwrot?.available).toBe(false);
    expect(zwrot?.reason).toBe('Podpiszcie protokół zwrotu');
  });

  it('z podpisanym protokolem ale bez zdjec zwrot nadal zablokowany', () => {
    const r = wynajem({ status: 'picked_up', contract_status: 'signed', payment_status: 'paid' });
    const zwrot = availableActions(r, { returnPhotos: 0, returnProtocolSigned: true })
      .find((a) => a.action === 'register_return');
    expect(zwrot?.available).toBe(false);
    expect(zwrot?.reason).toBe('Dodaj zdjęcia sprzętu po zwrocie');
  });

  it('protokol zwrotu i zdjecia razem pozwalaja przyjac zwrot', () => {
    const r = wynajem({ status: 'picked_up', contract_status: 'signed', payment_status: 'paid' });
    expect(akcje(r, gotoweDoZwrotu)).toContain('register_return');
  });

  it('protokol zwrotu mozna przygotowac dopiero po wydaniu', () => {
    expect(canPrepareReturn(wynajem({ status: 'confirmed' })).ok).toBe(false);
    const uKlienta = wynajem({ status: 'picked_up', contract_status: 'signed', payment_status: 'paid' });
    expect(canPrepareReturn(uKlienta).ok).toBe(true);
  });

  it('wydanego sprzetu nie mozna juz anulowac ani odrzucic', () => {
    const r = wynajem({ status: 'picked_up', contract_status: 'signed', payment_status: 'paid' });
    expect(akcje(r, gotoweDoZwrotu)).not.toContain('cancel');
    expect(akcje(r, gotoweDoZwrotu)).not.toContain('reject');
  });

  it('po zwrocie zostaje tylko zamkniecie najmu', () => {
    const r = wynajem({ status: 'returned', contract_status: 'signed', payment_status: 'paid' });
    expect(akcje(r, zeZdjeciami)).toEqual(['complete']);
  });

  it('stany koncowe nie maja zadnych akcji', () => {
    for (const status of ['completed', 'rejected', 'cancelled']) {
      expect(akcje(wynajem({ status }), zeZdjeciami)).toEqual([]);
    }
  });
});

describe('zamkniecie najmu bez pytania pracownika', () => {
  const zwrocony = (nadpisz: Record<string, unknown> = {}) =>
    wynajem({ status: 'returned', contract_status: 'signed', payment_status: 'paid', ...nadpisz });
  const rozliczony = { returnPhotos: 2, returnProtocolSigned: true };

  it('komplet warunkow zamyka najem samoczynnie', () => {
    expect(czyMoznaZamknacAutomatycznie(zwrocony(), rozliczony)).toBe(true);
  });

  it('panel nie rysuje przycisku, skoro system zamknie najem sam', () => {
    const zamkniecie = availableActions(zwrocony(), rozliczony).find((a) => a.action === 'complete');
    expect(zamkniecie?.available).toBe(true);
    expect(zamkniecie?.automatic).toBe(true);
  });

  it('nieoplacony najem zostaje otwarty i wymaga decyzji pracownika', () => {
    const r = zwrocony({ payment_status: 'unpaid' });
    expect(czyMoznaZamknacAutomatycznie(r, rozliczony)).toBe(false);
    const zamkniecie = availableActions(r, rozliczony).find((a) => a.action === 'complete');
    expect(zamkniecie?.automatic).toBeUndefined();
  });

  it('brak podpisanego protokolu zwrotu wstrzymuje zamkniecie', () => {
    expect(czyMoznaZamknacAutomatycznie(zwrocony(), { returnPhotos: 2, returnProtocolSigned: false })).toBe(false);
  });

  it('brak zdjec po zwrocie wstrzymuje zamkniecie', () => {
    expect(czyMoznaZamknacAutomatycznie(zwrocony(), { returnPhotos: 0, returnProtocolSigned: true })).toBe(false);
  });

  it('odrzucenie znika z panelu, bo powiela anulowanie', () => {
    const akcje = availableActions(wynajem(), bezZdjec);
    expect(akcje.find((a) => a.action === 'cancel')?.automatic).toBeUndefined();
    expect(akcje.find((a) => a.action === 'reject')?.automatic).toBe(true);
  });

  it('odrzucenie nadal dziala przez API mimo ukrycia w panelu', () => {
    expect(canTransition(wynajem(), 'rejected', bezZdjec).ok).toBe(true);
  });
});

describe('dwie sciezki obslugi: rezerwacja z gory i klient przy ladzie', () => {
  it('protokol wydania mozna spisac przed zaplata - przy ladzie kolejnosc bywa odwrotna', () => {
    const nieoplacona = wynajem({ status: 'confirmed', contract_status: 'signed', payment_status: 'unpaid' });
    expect(canPrepareHandover(nieoplacona).ok).toBe(true);
  });

  it('samo wydanie sprzetu nadal czeka na platnosc', () => {
    const nieoplacona = wynajem({ status: 'confirmed', contract_status: 'signed', payment_status: 'unpaid' });
    const wydanie = availableActions(nieoplacona, gotoweDoWydania).find((a) => a.action === 'hand_over');
    expect(wydanie?.available).toBe(false);
    expect(wydanie?.reason).toBe('Rezerwacja nie została opłacona');
  });

  it('bez podpisanej umowy protokolu nie ma z czego spisac', () => {
    const bezUmowy = wynajem({ status: 'confirmed', contract_status: 'ready' });
    expect(canPrepareHandover(bezUmowy).ok).toBe(false);
  });
});

describe('braki wstrzymuja, ale nie zamykaja drogi', () => {
  it('zla kolejnosc statusow jest nie do pominiecia - powstalby stan nie do odtworzenia', () => {
    const zapytanie = wynajem();
    const wynik = canTransition(zapytanie, 'returned', zeZdjeciami);
    expect(wynik.ok).toBe(false);
    expect(wynik.kolejnoscBledna).toBe(true);
  });

  it('ten sam status to tez blad kolejnosci, nie brak dokumentu', () => {
    const wynik = canTransition(wynajem({ status: 'confirmed' }), 'confirmed', bezZdjec);
    expect(wynik.kolejnoscBledna).toBe(true);
  });

  it('brak dokumentu wstrzymuje, ale nie jest bledem kolejnosci - pracownik moze wymusic', () => {
    const gotowa = wynajem({ status: 'confirmed', contract_status: 'signed', payment_status: 'paid' });
    const wynik = canTransition(gotowa, 'picked_up', { returnPhotos: 0, handoverPhotos: 0, handoverProtocolSigned: false });
    expect(wynik.ok).toBe(false);
    expect(wynik.kolejnoscBledna).toBeUndefined();
    expect(wynik.reason).toBe('Podpiszcie protokół wydania');
  });

  it('brak zdjec zwrotu tez jest do pominiecia', () => {
    const uKlienta = wynajem({ status: 'picked_up', contract_status: 'signed', payment_status: 'paid' });
    const wynik = canTransition(uKlienta, 'returned', { returnPhotos: 0, returnProtocolSigned: true });
    expect(wynik.ok).toBe(false);
    expect(wynik.kolejnoscBledna).toBeUndefined();
  });
});

describe('spojnosc panelu z API', () => {
  const statusy = ['pending', 'confirmed', 'picked_up', 'returned', 'completed', 'rejected', 'cancelled'];
  const umowy = ['not_prepared', 'ready', 'signed'];
  const platnosci = ['unpaid', 'paid', 'failed'];
  const zdjecia = [0, 3];
  const protokoly = [false, true];

  /** Kazda kombinacja danych, jaka moze wystapic w bazie. */
  const wszystkieKombinacje = statusy.flatMap((status) =>
    umowy.flatMap((contract_status) =>
      platnosci.flatMap((payment_status) =>
        zdjecia.flatMap((liczbaZdjec) =>
          protokoly.map((handoverProtocolSigned) => ({
            r: wynajem({ status, contract_status, payment_status }),
            ctx: {
              returnPhotos: liczbaZdjec,
              handoverPhotos: liczbaZdjec,
              handoverProtocolSigned,
              returnProtocolSigned: handoverProtocolSigned,
            },
          }))
        )
      )
    )
  );

  it('kazda akcja oferowana panelowi jest przyjmowana przez API', () => {
    for (const { r, ctx } of wszystkieKombinacje) {
      for (const akcja of availableActions(r, ctx)) {
        if (!akcja.available) continue;
        const cel = ACTION_TARGET_STATUS[akcja.action];
        const wynik = canTransition(r, cel, ctx);
        expect(
          wynik.ok,
          `akcja ${akcja.action} (${r.status}/${r.contract_status}/${r.payment_status}, zdjec ${ctx.returnPhotos}) `
          + `jest oferowana, ale API ja odrzuca: ${wynik.reason}`
        ).toBe(true);
      }
    }
  });

  it('API nie przepuszcza niczego, czego panel nie oferuje', () => {
    for (const { r, ctx } of wszystkieKombinacje) {
      const oferowane = new Set(
        availableActions(r, ctx).filter((a) => a.available).map((a) => ACTION_TARGET_STATUS[a.action])
      );
      for (const cel of statusy) {
        if (cel === r.status) continue;
        const wynik = canTransition(r, cel, ctx);
        if (wynik.ok) {
          expect(
            oferowane.has(cel),
            `API przepuszcza ${r.status} -> ${cel}, ale panel tego nie oferuje`
          ).toBe(true);
        }
      }
    }
  });

  it('stan koncowy nie ma zadnego wyjscia', () => {
    for (const status of ['completed', 'rejected', 'cancelled']) {
      for (const cel of statusy) {
        if (cel === status) continue;
        expect(canTransition(wynajem({ status }), cel, zeZdjeciami).ok).toBe(false);
      }
    }
  });
});

describe('bramka przejsc statusu', () => {
  it('blokuje skok z oczekujacej prosto na zwrocone', () => {
    const wynik = canTransition(wynajem(), 'returned', zeZdjeciami);
    expect(wynik.ok).toBe(false);
    expect(wynik.reason).toBe('Nie można przejść z „Oczekuje” do „Zwrócone”');
  });

  it('blokuje skok z oczekujacej na wydane', () => {
    expect(canTransition(wynajem(), 'picked_up', bezZdjec).ok).toBe(false);
  });

  it('blokuje cofniecie z zakonczonej na wydane', () => {
    const r = wynajem({ status: 'completed', contract_status: 'signed', payment_status: 'paid' });
    const wynik = canTransition(r, 'picked_up', zeZdjeciami);
    expect(wynik.ok).toBe(false);
  });

  it('blokuje ponowne ustawienie tego samego statusu', () => {
    const wynik = canTransition(wynajem(), 'pending', bezZdjec);
    expect(wynik.ok).toBe(false);
    expect(wynik.reason).toBe('Rezerwacja ma już ten status');
  });

  it('blokuje nieznany status', () => {
    expect(canTransition(wynajem(), 'wymyslony', bezZdjec).ok).toBe(false);
  });

  it('przepuszcza poprawna sciezke krok po kroku', () => {
    const potwierdzenie = canTransition(wynajem(), 'confirmed', bezZdjec);
    expect(potwierdzenie.ok).toBe(true);

    const doWydania = wynajem({ status: 'confirmed', contract_status: 'signed', payment_status: 'paid' });
    expect(canTransition(doWydania, 'picked_up', gotoweDoWydania).ok).toBe(true);

    const uKlienta = { ...doWydania, status: 'picked_up' };
    expect(canTransition(uKlienta, 'returned', gotoweDoZwrotu).ok).toBe(true);

    const zwrocony = { ...doWydania, status: 'returned' };
    expect(canTransition(zwrocony, 'completed', zeZdjeciami).ok).toBe(true);
  });

  it('kolejnosc statusow to za malo - warunki biznesowe tez musza byc spelnione', () => {
    // Status pozwala (confirmed -> picked_up), ale umowa nie jest podpisana.
    const r = wynajem({ status: 'confirmed', contract_status: 'not_prepared' });
    const wynik = canTransition(r, 'picked_up', bezZdjec);
    expect(wynik.ok).toBe(false);
    expect(wynik.reason).toBe('Najpierw przygotuj umowę najmu');
  });

  it('zwrot bez zdjec jest blokowany mimo poprawnej kolejnosci', () => {
    const r = wynajem({ status: 'picked_up', contract_status: 'signed', payment_status: 'paid' });
    const wynik = canTransition(r, 'returned', { returnPhotos: 0, returnProtocolSigned: true });
    expect(wynik.ok).toBe(false);
    expect(wynik.reason).toBe('Dodaj zdjęcia sprzętu po zwrocie');
  });

  it('zwrot bez podpisanego protokolu jest blokowany mimo zdjec', () => {
    const r = wynajem({ status: 'picked_up', contract_status: 'signed', payment_status: 'paid' });
    const wynik = canTransition(r, 'returned', zeZdjeciami);
    expect(wynik.ok).toBe(false);
    expect(wynik.reason).toBe('Podpiszcie protokół zwrotu');
  });

  it('odrzucenie i anulowanie dziala do momentu wydania', () => {
    expect(canTransition(wynajem(), 'rejected', bezZdjec).ok).toBe(true);
    expect(canTransition(wynajem(), 'cancelled', bezZdjec).ok).toBe(true);

    const wydany = wynajem({ status: 'picked_up', contract_status: 'signed', payment_status: 'paid' });
    expect(canTransition(wydany, 'cancelled', zeZdjeciami).ok).toBe(false);
  });
});
