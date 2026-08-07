import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router';
import {
  AlertTriangle,
  ArrowLeft,
  Camera,
  Check,
  CheckCircle2,
  Download,
  FileSignature,
  FileText,
  Loader2,
  Package,
  PackageOpen,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react';
import { Button, Card, Input, Textarea } from '@/components/ui';
import { SignatureField, type SignatureFieldHandle } from '@/components/SignatureField';
import { HandoverPhotos } from '@/components/HandoverPhotos';
import { ReturnDocument } from '@/components/ReturnDocument';
import ThemeToggle from '@/components/ThemeToggle';
import {
  downloadReturnPdf,
  getReturnProtocol,
  isAdminLoggedIn,
  saveReturnProtocol,
  signReturnProtocol,
  updateReservationStatus,
  type ReturnCharge,
  type ReturnChecklist,
  type ReturnProtocolView,
  type RodzajNaleznosci,
} from '@/services/adminApi';

const money = (value: number) => `${value.toFixed(2).replace('.', ',')} zł`;

const POZYCJE_LISTY: { klucz: keyof ReturnChecklist; etykieta: string }[] = [
  { klucz: 'complete', etykieta: 'Kompletny' },
  { klucz: 'working', etykieta: 'Sprawny' },
  { klucz: 'clean', etykieta: 'Czysty' },
  { klucz: 'undamaged', etykieta: 'Bez uszkodzeń' },
];

/** Gotowce z cennika (§12 umowy) — pracownik nie przepisuje ich z pamięci. */
const SZABLONY: { kind: RodzajNaleznosci; label: string; amount: number | null; podpowiedz: string }[] = [
  { kind: 'cleaning', label: 'Czyszczenie standardowe', amount: 30, podpowiedz: 'stała stawka 30 zł' },
  { kind: 'deep_cleaning', label: 'Czyszczenie pogłębione', amount: null, podpowiedz: 'do 50 zł — wpisz kwotę' },
  { kind: 'damage', label: 'Uszkodzenie', amount: null, podpowiedz: 'kwota albo „do wyceny w serwisie”' },
  { kind: 'missing', label: 'Brakujący element', amount: null, podpowiedz: 'wpisz czego brakuje i ile kosztuje' },
  { kind: 'penalty', label: 'Kara za przetrzymanie', amount: null, podpowiedz: '200 zł za każdą rozpoczętą dobę' },
  { kind: 'other', label: 'Inna należność', amount: null, podpowiedz: 'opisz i wyceń' },
];

/** Każda należność pyta o co innego — jedna podpowiedź dla wszystkich myliła. */
const PRZYKLAD_SZCZEGOLOW: Record<RodzajNaleznosci, string> = {
  cleaning: 'Szczegóły, np. „sprzęt oddany zabrudzony”',
  deep_cleaning: 'Szczegóły, np. „zaschnięta zaprawa w zbiorniku”',
  damage: 'Szczegóły, np. „pęknięta obudowa zbiornika”',
  missing: 'Szczegóły, np. „brak dyszy punktowej”',
  penalty: 'Szczegóły, np. „zwrot 2 doby po terminie”',
  other: 'Szczegóły — czego dotyczy należność',
};

/**
 * Protokół zwrotu — ten sam układ co przy wydaniu: dane, gotowy dokument, podpisy,
 * a rejestracja zwrotu to osobny krok po zdjęciach.
 */
export function ReturnProtocolPage() {
  const { id } = useParams();
  const reservationId = Number(id);

  const [view, setView] = useState<ReturnProtocolView | null>(null);
  const [ladowanie, setLadowanie] = useState(true);
  const [blad, setBlad] = useState<string | null>(null);
  const [komunikat, setKomunikat] = useState<{ tekst: string; ton: 'success' | 'error' } | null>(null);

  const [krok, setKrok] = useState<'dane' | 'podpis'>('dane');
  const [pozycje, setPozycje] = useState<string[]>([]);
  const [lista, setLista] = useState<ReturnChecklist>({ complete: true, working: true, clean: true, undamaged: true });
  const [uwagi, setUwagi] = useState('');
  const [naleznosci, setNaleznosci] = useState<ReturnCharge[]>([]);
  const [kaucja, setKaucja] = useState(0);
  const [rozliczonoNaMiejscu, setRozliczonoNaMiejscu] = useState(false);
  const [przyjmujacy, setPrzyjmujacy] = useState('');

  const [maPodpisPracownika, setMaPodpisPracownika] = useState(false);
  const [maPodpisKlienta, setMaPodpisKlienta] = useState(false);
  const [zapisywanie, setZapisywanie] = useState(false);
  const podpisPracownika = useRef<SignatureFieldHandle>(null);
  const podpisKlienta = useRef<SignatureFieldHandle>(null);

  const wczytaj = useCallback(async () => {
    setLadowanie(true);
    const odpowiedz = await getReturnProtocol(reservationId);
    if (odpowiedz.success && odpowiedz.data) {
      const dane = odpowiedz.data as ReturnProtocolView;
      setView(dane);
      setPozycje(dane.snapshot.items);
      setLista(dane.snapshot.checklist);
      setUwagi(dane.snapshot.conditionNotes);
      setNaleznosci(dane.snapshot.charges);
      setKaucja(dane.snapshot.deposit);
      setRozliczonoNaMiejscu(Boolean(dane.snapshot.rozliczonoNaMiejscu));
      setPrzyjmujacy(dane.snapshot.employeeName);
      setBlad(null);
    } else {
      setBlad(odpowiedz.message || 'Nie udało się otworzyć protokołu zwrotu');
    }
    setLadowanie(false);
  }, [reservationId]);

  useEffect(() => {
    // Pobranie danych to synchronizacja z serwerem, a nie wyliczanie stanu z propsów.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (Number.isFinite(reservationId)) void wczytaj();
  }, [reservationId, wczytaj]);

  if (!isAdminLoggedIn()) return <Navigate to="/admin" replace />;
  if (!Number.isFinite(reservationId)) return <Navigate to="/admin" replace />;

  const powiadom = (tekst: string, ton: 'success' | 'error' = 'success') => {
    setKomunikat({ tekst, ton });
    setTimeout(() => setKomunikat(null), 5000);
  };

  const dane = () => ({
    items: pozycje.map((p) => p.trim()).filter(Boolean),
    checklist: lista,
    conditionNotes: uwagi.trim(),
    charges: naleznosci
      .filter((p) => p.label.trim().length >= 2)
      .map((p) => ({ ...p, label: p.label.trim(), note: p.note?.trim() || undefined })),
    deposit: Number(kaucja) || 0,
    rozliczonoNaMiejscu,
    employeeName: przyjmujacy.trim(),
  });

  const braki = (): string[] => {
    const powody: string[] = [];
    if (pozycje.map((p) => p.trim()).filter(Boolean).length === 0) powody.push('lista zwracanego sprzętu');
    if (przyjmujacy.trim().length < 3) powody.push('imię i nazwisko przyjmującego');
    const zastrzezenia = POZYCJE_LISTY.some(({ klucz }) => !lista[klucz]);
    if (zastrzezenia && uwagi.trim().length < 3) powody.push('opis zastrzeżeń w uwagach');
    return powody;
  };

  const generuj = async () => {
    setZapisywanie(true);
    const odpowiedz = await saveReturnProtocol(reservationId, dane());
    if (odpowiedz.success) {
      await wczytaj();
      setKrok('podpis');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      powiadom(odpowiedz.message || 'Nie udało się przygotować protokołu', 'error');
    }
    setZapisywanie(false);
  };

  const podpisz = async () => {
    if (!view || !podpisPracownika.current || !podpisKlienta.current) return;
    setZapisywanie(true);
    const odpowiedz = await signReturnProtocol(reservationId, {
      contentHash: view.contentHash,
      staffSignature: podpisPracownika.current.toDataURL(),
      renterSignature: podpisKlienta.current.toDataURL(),
    });
    if (odpowiedz.success) {
      await wczytaj();
      powiadom(odpowiedz.message || 'Protokół zwrotu podpisany');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      powiadom(odpowiedz.message || 'Nie udało się podpisać protokołu', 'error');
    }
    setZapisywanie(false);
  };

  const przyjmij = async () => {
    setZapisywanie(true);
    const odpowiedz = await updateReservationStatus(reservationId, 'returned', {
      note: `Zwrot przyjęty na podstawie protokołu ${view?.snapshot.protocolNumber ?? ''}`.trim(),
      changedBy: view?.snapshot.employeeName || 'obsługa',
    });
    if (odpowiedz.success) {
      await wczytaj();
      powiadom('Zwrot przyjęty — sprzęt wrócił do wypożyczalni');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      powiadom(odpowiedz.message || 'Nie udało się przyjąć zwrotu', 'error');
    }
    setZapisywanie(false);
  };

  const linkDoPanelu = (
    <Link to="/admin" className="inline-flex items-center gap-2 text-sm text-text-muted hover:text-gold transition-colors">
      <ArrowLeft className="w-4 h-4" /> Wróć do panelu
    </Link>
  );

  const powrot = (
    <div className="flex items-center justify-between gap-3">
      {linkDoPanelu}
      <ThemeToggle className="h-9 w-9" />
    </div>
  );

  if (ladowanie) {
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-gold" />
      </div>
    );
  }

  if (blad || !view) {
    return (
      <div className="min-h-screen bg-bg-primary px-4 py-10">
        <div className="max-w-2xl mx-auto space-y-5">
          {powrot}
          <Card variant="glass" className="p-8 text-center">
            <p className="text-text-primary font-semibold">Nie można otworzyć protokołu zwrotu</p>
            <p className="text-sm text-text-muted mt-2">{blad}</p>
          </Card>
        </div>
      </div>
    );
  }

  const { snapshot } = view;
  const podpisany = view.status === 'signed';
  const przyjety = view.registered;
  const brakujace = braki();

  const sumaZnanych = naleznosci.reduce((suma, p) => suma + (p.amount ?? 0), 0);
  const doRozliczenia = sumaZnanych - (Number(kaucja) || 0);

  const naglowek = (
    <header className="space-y-1">
      <p className="text-xs uppercase tracking-wider text-gold">Załącznik nr 2</p>
      <h1 className="text-2xl sm:text-3xl font-bold text-text-primary">Protokół zwrotu sprzętu</h1>
      <p className="text-sm text-text-muted">
        {snapshot.protocolNumber}
        {snapshot.contractNumber ? ` • do umowy ${snapshot.contractNumber}` : ''}
      </p>
    </header>
  );

  const pasekKomunikatu = komunikat && (
    <div
      className={`p-3 rounded-[--radius-sm] text-sm border ${
        komunikat.ton === 'success'
          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300 light:text-emerald-700'
          : 'bg-red-500/10 border-red-500/30 text-red-300 light:text-red-700'
      }`}
    >
      {komunikat.tekst}
    </div>
  );

  // === Po podpisaniu: zdjęcia i dopiero przyjęcie zwrotu ===
  if (podpisany) {
    return (
      <div className="min-h-screen bg-bg-primary px-4 py-6 sm:py-10">
        <div className="max-w-3xl mx-auto space-y-5">
          {powrot}
          {naglowek}
          {pasekKomunikatu}

          <Card
            variant="glass"
            className={`p-5 ${przyjety ? 'border-emerald-500/30 bg-emerald-500/[0.06]' : 'border-gold/30 bg-gold/[0.05]'}`}
          >
            <div className="flex items-start gap-3">
              <CheckCircle2 className={`w-5 h-5 shrink-0 mt-0.5 ${przyjety ? 'text-emerald-400 light:text-emerald-700' : 'text-gold'}`} />
              <div className="flex-1">
                <p className="font-semibold text-text-primary">
                  {przyjety ? 'Zwrot przyjęty' : 'Protokół zwrotu podpisany'}
                </p>
                <p className="text-sm text-text-muted mt-1">
                  {view.signedAt ? `Podpisano ${new Date(view.signedAt).toLocaleString('pl-PL')}. ` : ''}
                  {przyjety
                    ? 'Sprzęt wrócił do wypożyczalni. Pozostało zamknięcie najmu w panelu.'
                    : 'Rozliczenie wysłaliśmy klientowi mailem. Zrób zdjęcia zwróconego sprzętu i przyjmij zwrot.'}
                </p>
                <Button variant="secondary" size="sm" className="mt-3" onClick={() => void downloadReturnPdf(reservationId)}>
                  <Download className="w-4 h-4 mr-2" /> Pobierz protokół
                </Button>
              </div>
            </div>
          </Card>

          <Card variant="glass" className="p-5 space-y-3">
            <div className="flex items-center gap-2">
              <Camera className="w-4 h-4 text-gold" />
              <h2 className="font-semibold text-text-primary">Zdjęcia zwróconego sprzętu</h2>
            </div>
            <p className="text-xs text-text-muted">
              {przyjety
                ? 'Zdjęcia zostają w dokumentacji najmu jako dowód stanu przy zwrocie.'
                : 'Bez zdjęć nie da się przyjąć zwrotu — to jedyny dowód, w jakim stanie sprzęt wrócił.'}
            </p>
            <HandoverPhotos
              reservationId={reservationId}
              takenBy={snapshot.employeeName}
              phases={['after']}
              onNotify={(tekst, ton) => {
                powiadom(tekst, ton);
                void wczytaj();
              }}
            />
          </Card>

          {!przyjety && (
            <Card variant="glass" className="p-5 space-y-3">
              <h2 className="font-semibold text-text-primary">Przyjęcie zwrotu</h2>
              {!view.canRegister && view.registerBlockedReason && (
                <p className="text-xs text-amber-400 light:text-amber-800 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  {view.registerBlockedReason}
                </p>
              )}
              <Button
                variant="primary"
                className="w-full"
                disabled={zapisywanie || !view.canRegister}
                onClick={() => void przyjmij()}
              >
                {zapisywanie ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <PackageOpen className="w-4 h-4 mr-2" />}
                Przyjmij zwrot
              </Button>
              <p className="text-xs text-text-muted text-center">
                Dopiero to zwalnia sprzęt w systemie i udostępnia termin innym klientom.
              </p>
            </Card>
          )}

          <ReturnDocument snapshot={snapshot} />

          <div className="pb-8">{linkDoPanelu}</div>
        </div>
      </div>
    );
  }

  // === Krok 2: gotowy dokument i podpisy ===
  if (krok === 'podpis') {
    return (
      <div className="min-h-screen bg-bg-primary px-4 py-6 sm:py-10">
        <div className="max-w-3xl mx-auto space-y-5">
          {powrot}
          {naglowek}
          {pasekKomunikatu}

          <Card variant="glass" className="p-4 border-gold/30 bg-gold/[0.05]">
            <p className="text-sm text-text-primary">
              <strong>Pokaż ten dokument klientowi.</strong> Poniżej pełna treść protokołu wraz z rozliczeniem
              w wersji, którą obie Strony podpisują. Po podpisaniu nic już nie da się zmienić.
            </p>
          </Card>

          <ReturnDocument snapshot={snapshot} />

          {!view.canSign && (
            <Card variant="glass" className="p-4 border-amber-500/30 bg-amber-500/[0.06]">
              <p className="text-sm text-amber-300 light:text-amber-800 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                {view.blockedReason}
              </p>
            </Card>
          )}

          <Card variant="glass" className="p-5 space-y-4">
            <div className="flex items-center gap-2">
              <FileSignature className="w-4 h-4 text-gold" />
              <h2 className="font-semibold text-text-primary">Podpisy pod powyższym protokołem</h2>
            </div>
            <p className="text-xs text-text-muted">Kolejność podpisów nie ma znaczenia.</p>

            <div className="grid gap-4 lg:grid-cols-2">
              <SignatureField
                ref={podpisPracownika}
                title="Podpis przyjmującego"
                signerName={snapshot.employeeName || 'Wynajmujący'}
                ariaLabel="Pole podpisu przyjmującego zwrot"
                onStateChange={setMaPodpisPracownika}
              />
              <SignatureField
                ref={podpisKlienta}
                title="Podpis klienta"
                signerName={view.customerName}
                ariaLabel="Pole podpisu klienta"
                onStateChange={setMaPodpisKlienta}
              />
            </div>

            {(!maPodpisPracownika || !maPodpisKlienta) && (
              <p className="text-xs text-amber-400 light:text-amber-800">
                Do podpisania brakuje:{' '}
                {[!maPodpisPracownika && 'podpis przyjmującego', !maPodpisKlienta && 'podpis klienta']
                  .filter(Boolean)
                  .join(', ')}
                .
              </p>
            )}

            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                variant="primary"
                disabled={zapisywanie || !maPodpisPracownika || !maPodpisKlienta || !view.canSign}
                onClick={() => void podpisz()}
                className="flex-1"
              >
                {zapisywanie ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
                Podpisz protokół
              </Button>
              <Button variant="ghost" disabled={zapisywanie} onClick={() => setKrok('dane')}>
                <Pencil className="w-4 h-4 mr-2" /> Popraw dane
              </Button>
            </div>
            <p className="text-xs text-text-muted text-center">
              Podpis zamyka dokument i wysyła rozliczenie klientowi. Zwrot zarejestrujecie w następnym kroku.
            </p>
          </Card>

          <div className="pb-8">{linkDoPanelu}</div>
        </div>
      </div>
    );
  }

  // === Krok 1: dane do protokołu ===
  return (
    <div className="min-h-screen bg-bg-primary px-4 py-6 sm:py-10">
      <div className="max-w-3xl mx-auto space-y-5">
        {powrot}
        {naglowek}
        {pasekKomunikatu}

        {!view.canSign && (
          <Card variant="glass" className="p-4 border-amber-500/30 bg-amber-500/[0.06]">
            <p className="text-sm text-amber-300 light:text-amber-800 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              {view.blockedReason}
            </p>
          </Card>
        )}

        <Card variant="glass" className="p-5 space-y-3">
          <h2 className="font-semibold text-text-primary">Dane zwrotu</h2>
          <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
            <div>
              <dt className="text-text-muted">Klient</dt>
              <dd className="text-text-primary">{snapshot.renter.name}</dd>
            </div>
            <div>
              <dt className="text-text-muted">Rezerwacja</dt>
              <dd className="text-text-primary">#{snapshot.rental.reservationId}</dd>
            </div>
            <div>
              <dt className="text-text-muted">Protokół wydania</dt>
              <dd className="text-text-primary">{snapshot.handoverProtocolNumber || '—'}</dd>
            </div>
            <div>
              <dt className="text-text-muted">Opóźnienie</dt>
              <dd className={snapshot.overdueDays > 0 ? 'text-amber-400 light:text-amber-800 font-medium' : 'text-text-primary'}>
                {snapshot.overdueDays > 0 ? `${snapshot.overdueDays} rozpoczętych dób` : 'brak'}
              </dd>
            </div>
          </dl>
          {snapshot.conditionAtHandover && (
            <div className="pt-2 border-t border-border">
              <p className="text-xs text-text-muted uppercase tracking-wide mb-1">Stan przy wydaniu</p>
              <p className="text-sm text-text-secondary">{snapshot.conditionAtHandover}</p>
            </div>
          )}
        </Card>

        <Card variant="glass" className="p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4 text-gold" />
            <h2 className="font-semibold text-text-primary">Zwracany sprzęt</h2>
          </div>
          {/* Lista jest kopią protokołu wydania i musi się zgadzać — gdyby dawała się
              tu poprawić, brakujący element zniknąłby bez śladu zamiast trafić do rozliczeń. */}
          <p className="text-xs text-text-muted">
            Dokładnie to, co klient dostał przy wydaniu. Czegoś brakuje albo jest uszkodzone?
            Nie zmieniaj listy — dopisz to niżej jako należność.
          </p>
          <ul className="space-y-1.5">
            {pozycje.map((pozycja, index) => (
              <li key={index} className="flex items-start gap-2 text-sm text-text-secondary">
                <Check className="w-4 h-4 text-gold shrink-0 mt-0.5" aria-hidden="true" />
                {pozycja}
              </li>
            ))}
          </ul>
        </Card>

        <Card variant="glass" className="p-5 space-y-3">
          <h2 className="font-semibold text-text-primary">Ocena stanu</h2>
          <div className="grid sm:grid-cols-2 gap-2">
            {POZYCJE_LISTY.map(({ klucz, etykieta }) => (
              <label
                key={klucz}
                className={`flex items-center gap-3 p-3 rounded-[--radius-sm] border cursor-pointer transition-colors ${
                  lista[klucz] ? 'border-emerald-500/40 bg-emerald-500/[0.07]' : 'border-amber-500/40 bg-amber-500/[0.07]'
                }`}
              >
                <input
                  spellCheck={false}
                  type="checkbox"
                  checked={lista[klucz]}
                  onChange={(e) => setLista((s) => ({ ...s, [klucz]: e.target.checked }))}
                  className="w-4 h-4 accent-gold"
                />
                <span className="text-sm text-text-primary">{etykieta}</span>
                {!lista[klucz] && <span className="ml-auto text-xs text-amber-400 light:text-amber-800">nie</span>}
              </label>
            ))}
          </div>
          <Textarea
            value={uwagi}
            rows={4}
            onChange={(e) => setUwagi(e.target.value)}
            placeholder="Opisz wady, zabrudzenia, uszkodzenia, braki. Porównaj ze stanem przy wydaniu…"
            aria-label="Uwagi do stanu przy zwrocie"
          />
          <p className="text-xs text-text-muted">
            Jeśli odznaczysz którykolwiek punkt, opis jest obowiązkowy — to on uzasadnia należności.
          </p>
        </Card>

        <Card variant="glass" className="p-5 space-y-3">
          <h2 className="font-semibold text-text-primary">Rozliczenie</h2>
          <p className="text-xs text-text-muted">
            Dodaj tylko te pozycje, które faktycznie obciążają klienta. Kwotę można zostawić pustą — wtedy
            w protokole pojawi się „do wyceny w serwisie”.
          </p>

          <div className="flex flex-wrap gap-2">
            {SZABLONY.map((szablon) => (
              <Button
                key={szablon.kind}
                variant="ghost"
                size="sm"
                onClick={() => setNaleznosci((l) => [...l, { kind: szablon.kind, label: szablon.label, amount: szablon.amount, note: '' }])}
                title={szablon.podpowiedz}
              >
                <Plus className="w-3.5 h-3.5 mr-1.5" /> {szablon.label}
              </Button>
            ))}
          </div>

          {naleznosci.length > 0 && (
            <div className="space-y-3">
              {naleznosci.map((pozycja, index) => (
                <div key={index} className="p-3 rounded-[--radius-sm] border border-border space-y-2">
                  <div className="flex gap-2">
                    <Input
                      value={pozycja.label}
                      aria-label={`Nazwa należności ${index + 1}`}
                      onChange={(e) => setNaleznosci((l) => l.map((p, i) => (i === index ? { ...p, label: e.target.value } : p)))}
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={`Usuń należność ${index + 1}`}
                      onClick={() => setNaleznosci((l) => l.filter((_, i) => i !== index))}
                      className="text-red-400 light:text-red-700 shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                  <Input
                    value={pozycja.note ?? ''}
                    placeholder={PRZYKLAD_SZCZEGOLOW[pozycja.kind] ?? PRZYKLAD_SZCZEGOLOW.other}
                    aria-label={`Szczegóły należności ${index + 1}`}
                    onChange={(e) => setNaleznosci((l) => l.map((p, i) => (i === index ? { ...p, note: e.target.value } : p)))}
                  />
                  <div className="flex items-center gap-3">
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={pozycja.amount === null ? '' : String(pozycja.amount)}
                      placeholder="kwota"
                      aria-label={`Kwota należności ${index + 1}`}
                      onChange={(e) =>
                        setNaleznosci((l) =>
                          l.map((p, i) => (i === index ? { ...p, amount: e.target.value === '' ? null : Number(e.target.value) } : p))
                        )
                      }
                    />
                    <label className="flex items-center gap-2 text-xs text-text-muted whitespace-nowrap cursor-pointer">
                      <input
                        spellCheck={false}
                        type="checkbox"
                        checked={pozycja.amount === null}
                        onChange={(e) =>
                          setNaleznosci((l) => l.map((p, i) => (i === index ? { ...p, amount: e.target.checked ? null : 0 } : p)))
                        }
                        className="w-4 h-4 accent-gold"
                      />
                      do wyceny w serwisie
                    </label>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="pt-3 border-t border-border space-y-2">
            <div className="flex items-center justify-between gap-4">
              <span className="text-sm text-text-secondary">Kaucja wpłacona</span>
              <div className="w-32">
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={String(kaucja)}
                  aria-label="Kaucja"
                  onChange={(e) => setKaucja(Number(e.target.value) || 0)}
                />
              </div>
            </div>
            <div className="flex justify-between text-sm text-text-secondary">
              <span>Razem należności</span>
              <span className="tabular-nums">{money(sumaZnanych)}</span>
            </div>
            <div className="flex justify-between font-semibold text-text-primary">
              <span>{doRozliczenia > 0 ? 'Do dopłaty przez klienta' : doRozliczenia < 0 ? 'Do zwrotu z kaucji' : 'Do rozliczenia'}</span>
              <span className="tabular-nums">{money(Math.abs(doRozliczenia))}</span>
            </div>
            {naleznosci.some((p) => p.amount === null) && (
              <p className="text-xs text-text-muted">
                Pozycje „do wyceny” nie wchodzą jeszcze do sumy — kwotę wpiszesz po otrzymaniu faktury serwisu.
              </p>
            )}
            {doRozliczenia > 0 && (
              <label className="flex items-start gap-2.5 pt-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-0.5 accent-gold"
                  checked={rozliczonoNaMiejscu}
                  onChange={(e) => setRozliczonoNaMiejscu(e.target.checked)}
                />
                <span className="text-sm text-text-secondary">
                  Klient dopłacił gotówką przy zwrocie
                  <span className="block text-xs text-text-muted">
                    Bez zaznaczenia klient dostanie mailem link do zapłaty {money(doRozliczenia)}.
                  </span>
                </span>
              </label>
            )}
          </div>
        </Card>

        <Card variant="glass" className="p-5 space-y-4">
          <h2 className="font-semibold text-text-primary">Przyjmujący zwrot</h2>
          <Input
            label="Imię i nazwisko"
            value={przyjmujacy}
            onChange={(e) => setPrzyjmujacy(e.target.value)}
            placeholder="np. Kamil Kida"
          />
          {brakujace.length > 0 && (
            <p className="text-xs text-amber-400 light:text-amber-800">
              Do wygenerowania protokołu brakuje: {brakujace.join(', ')}.
            </p>
          )}
          <Button
            variant="primary"
            className="w-full"
            disabled={zapisywanie || brakujace.length > 0}
            onClick={() => void generuj()}
          >
            {zapisywanie ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileText className="w-4 h-4 mr-2" />}
            Generuj protokół
          </Button>
          <p className="text-xs text-text-muted text-center">
            Zobaczysz pełną treść z rozliczeniem. Podpisy składacie dopiero pod nią.
          </p>
        </Card>

        <div className="pb-8">{linkDoPanelu}</div>
      </div>
    </div>
  );
}

export default ReturnProtocolPage;
