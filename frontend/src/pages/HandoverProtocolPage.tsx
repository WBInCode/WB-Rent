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
  PackageCheck,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react';
import { Button, Card, Input, Textarea } from '@/components/ui';
import { SignatureField, type SignatureFieldHandle } from '@/components/SignatureField';
import { HandoverPhotos } from '@/components/HandoverPhotos';
import { HandoverDocument } from '@/components/HandoverDocument';
import { ContractDocument } from '@/components/ContractDocument';
import { PaymentLinkPanel } from '@/components/PaymentLinkPanel';
import ThemeToggle from '@/components/ThemeToggle';
import type { ContractPreviewResponse } from '@/services/api';
import {
  createContractSession,
  downloadHandoverPdf,
  getHandoverProtocol,
  getReservationContractPreview,
  isAdminLoggedIn,
  saveHandoverProtocol,
  signHandoverProtocol,
  signReservationContract,
  updateReservationStatus,
  type HandoverProtocolView,
} from '@/services/adminApi';

const polishDate = (value: string) => {
  const [year, month, day] = value.slice(0, 10).split('-');
  return day && month && year ? `${day}.${month}.${year}` : value;
};

/**
 * Protokół wydania podpisywany na miejscu, na urządzeniu pracownika. Dwa kroki:
 * najpierw pracownik uzupełnia dane, potem obie Strony czytają gotowy dokument
 * i dopiero pod nim składają podpisy.
 */
export function HandoverProtocolPage() {
  const { id } = useParams();
  const reservationId = Number(id);

  const [view, setView] = useState<HandoverProtocolView | null>(null);
  const [ladowanie, setLadowanie] = useState(true);
  const [blad, setBlad] = useState<string | null>(null);
  const [komunikat, setKomunikat] = useState<{ tekst: string; ton: 'success' | 'error' } | null>(null);

  const [krok, setKrok] = useState<'dane' | 'podpis'>('dane');
  const [pozycje, setPozycje] = useState<string[]>([]);
  const [stan, setStan] = useState('');
  const [wydajacy, setWydajacy] = useState('');
  const [zdjecPrzed, setZdjecPrzed] = useState(0);

  const [maPodpisPracownika, setMaPodpisPracownika] = useState(false);
  const [maPodpisKlienta, setMaPodpisKlienta] = useState(false);
  const [zapisywanie, setZapisywanie] = useState(false);
  const podpisPracownika = useRef<SignatureFieldHandle>(null);
  const podpisKlienta = useRef<SignatureFieldHandle>(null);

  // Umowa najmu podpisywana przy ladzie — pierwszy krok wydania.
  const [umowa, setUmowa] = useState<ContractPreviewResponse | null>(null);
  const [zaakceptowana, setZaakceptowana] = useState(false);
  const [maPodpisWynajmujacego, setMaPodpisWynajmujacego] = useState(false);
  const [maPodpisNajemcy, setMaPodpisNajemcy] = useState(false);
  const podpisWynajmujacego = useRef<SignatureFieldHandle>(null);
  const podpisNajemcy = useRef<SignatureFieldHandle>(null);
  const [daneUmowy, setDaneUmowy] = useState({
    renterAddress: '',
    documentType: 'dowod_osobisty' as 'dowod_osobisty' | 'paszport',
    documentNumber: '',
    pesel: '',
    deposit: 0,
    accessories: '',
  });

  const wczytaj = useCallback(async () => {
    setLadowanie(true);
    const odpowiedz = await getHandoverProtocol(reservationId);
    if (odpowiedz.success && odpowiedz.data) {
      const dane = odpowiedz.data as HandoverProtocolView;
      setView(dane);
      setPozycje(dane.snapshot.items);
      setStan(dane.snapshot.conditionNotes);
      setWydajacy(dane.snapshot.employeeName);
      setBlad(null);
    } else {
      setBlad(odpowiedz.message || 'Nie udało się otworzyć protokołu');
    }
    setLadowanie(false);
  }, [reservationId]);

  useEffect(() => {
    if (Number.isFinite(reservationId)) void wczytaj();
  }, [reservationId, wczytaj]);

  // Treść umowy pobierana dopiero wtedy, gdy jest co podpisywać.
  useEffect(() => {
    if (view?.contractStatus !== 'ready') return;
    let anulowane = false;
    void getReservationContractPreview(reservationId).then((odpowiedz) => {
      if (anulowane) return;
      if (odpowiedz.success && odpowiedz.data) setUmowa(odpowiedz.data as ContractPreviewResponse);
    });
    return () => {
      anulowane = true;
    };
  }, [reservationId, view?.contractStatus]);

  if (!isAdminLoggedIn()) return <Navigate to="/admin" replace />;
  if (!Number.isFinite(reservationId)) return <Navigate to="/admin" replace />;

  const powiadom = (tekst: string, ton: 'success' | 'error' = 'success') => {
    setKomunikat({ tekst, ton });
    setTimeout(() => setKomunikat(null), 5000);
  };

  const brakiDanych = (): string[] => {
    const braki: string[] = [];
    if (pozycje.map((p) => p.trim()).filter(Boolean).length === 0) braki.push('lista wydawanego sprzętu');
    if (stan.trim().length < 2) braki.push('opis stanu sprzętu');
    if (wydajacy.trim().length < 3) braki.push('imię i nazwisko wydającego');
    return braki;
  };

  /** Umowa dla rezerwacji złożonej przez stronę — dane spisujemy przy ladzie. */
  const przygotujUmowe = async () => {
    const braki = [
      daneUmowy.renterAddress.trim().length < 5 && 'adres zamieszkania',
      !/^\d{11}$/.test(daneUmowy.pesel) && 'PESEL (11 cyfr)',
      daneUmowy.accessories.trim().length < 2 && 'wydawane akcesoria',
      wydajacy.trim().length < 3 && 'imię i nazwisko wydającego',
    ].filter(Boolean) as string[];
    if (braki.length > 0) {
      powiadom(`Uzupełnij: ${braki.join(', ')}`, 'error');
      return;
    }
    setZapisywanie(true);
    const odpowiedz = await createContractSession({
      reservationId,
      renterAddress: daneUmowy.renterAddress.trim(),
      documentType: daneUmowy.documentType,
      documentNumber: daneUmowy.documentNumber.trim(),
      pesel: daneUmowy.pesel,
      employeeName: wydajacy.trim(),
      deposit: Number(daneUmowy.deposit),
      accessories: daneUmowy.accessories.trim(),
      conditionNotes: stan.trim() || 'Sprzęt sprawny, kompletny, bez widocznych uszkodzeń.',
      handoverItems: pozycje.map((pozycja) => pozycja.trim()).filter(Boolean),
    });
    if (odpowiedz.success) {
      await wczytaj();
    } else {
      powiadom(odpowiedz.message || 'Nie udało się przygotować umowy', 'error');
    }
    setZapisywanie(false);
  };

  const podpiszUmowe = async () => {
    if (!podpisWynajmujacego.current || !podpisNajemcy.current) return;
    setZapisywanie(true);
    const odpowiedz = await signReservationContract(reservationId, {
      lessorSignature: podpisWynajmujacego.current.toDataURL(),
      renterSignature: podpisNajemcy.current.toDataURL(),
    });
    if (odpowiedz.success) {
      setUmowa(null);
      setZaakceptowana(false);
      await wczytaj();
      powiadom('Umowa podpisana. Teraz protokół wydania.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      powiadom(odpowiedz.message || 'Nie udało się podpisać umowy', 'error');
    }
    setZapisywanie(false);
  };

  const generuj = async () => {
    setZapisywanie(true);
    const odpowiedz = await saveHandoverProtocol(reservationId, {
      items: pozycje.map((pozycja) => pozycja.trim()).filter(Boolean),
      conditionNotes: stan.trim(),
      employeeName: wydajacy.trim(),
    });
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
    const odpowiedz = await signHandoverProtocol(reservationId, {
      contentHash: view.contentHash,
      staffSignature: podpisPracownika.current.toDataURL(),
      renterSignature: podpisKlienta.current.toDataURL(),
    });
    if (odpowiedz.success) {
      await wczytaj();
      powiadom(odpowiedz.message || 'Protokół podpisany');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      powiadom(odpowiedz.message || 'Nie udało się podpisać protokołu', 'error');
    }
    setZapisywanie(false);
  };

  const wydaj = async () => {
    setZapisywanie(true);
    const odpowiedz = await updateReservationStatus(reservationId, 'picked_up', {
      note: `Sprzęt wydany na podstawie protokołu ${view?.snapshot.protocolNumber ?? ''}`.trim(),
      changedBy: view?.snapshot.employeeName || 'obsługa',
    });
    if (odpowiedz.success) {
      await wczytaj();
      powiadom('Sprzęt wydany klientowi');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      powiadom(odpowiedz.message || 'Nie udało się wydać sprzętu', 'error');
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
            <p className="text-text-primary font-semibold">Nie można otworzyć protokołu wydania</p>
            <p className="text-sm text-text-muted mt-2">{blad}</p>
          </Card>
        </div>
      </div>
    );
  }

  const { snapshot } = view;
  const podpisany = view.status === 'signed';
  const wydany = view.released;
  // Brak zapłaty to jedyna blokada, którą da się zdjąć na miejscu — klient płaci
  // gotówką, terminalem albo z telefonu, i sprzęt może od razu wyjechać.
  const czekaNaPlatnosc = !wydany && !view.canRelease
    && /opłacon|płatnoś|zapłat/i.test(view.releaseBlockedReason ?? '');
  const braki = brakiDanych();

  const naglowek = (
    <header className="space-y-1">
      <p className="text-xs uppercase tracking-wider text-gold">Załącznik nr 1</p>
      <h1 className="text-2xl sm:text-3xl font-bold text-text-primary">Protokół wydania sprzętu</h1>
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

  // === Umowa najmu: pierwszy krok wydania, podpisywany tu, a nie z linku ===
  if (!wydany && view.contractStatus !== 'signed') {
    return (
      <div className="min-h-screen bg-bg-primary px-4 py-6 sm:py-10">
        <div className="max-w-3xl mx-auto space-y-5">
          {powrot}
          {naglowek}
          {pasekKomunikatu}

          <KrokiWydania aktywny="umowa" />

          {view.contractStatus === 'missing' ? (
            <Card variant="glass" className="p-5 space-y-4">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-gold" />
                <h2 className="font-semibold text-text-primary">Dane do umowy najmu</h2>
              </div>
              <p className="text-xs text-text-muted">
                Przepisz dane z dokumentu tożsamości klienta. Po zapisaniu umowa pojawi się tu do podpisania.
              </p>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <Input
                    label="Adres zamieszkania najemcy"
                    value={daneUmowy.renterAddress}
                    onChange={(event) => setDaneUmowy((current) => ({ ...current, renterAddress: event.target.value }))}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1.5">Rodzaj dokumentu</label>
                  <select
                    value={daneUmowy.documentType}
                    onChange={(event) => setDaneUmowy((current) => ({
                      ...current,
                      documentType: event.target.value as 'dowod_osobisty' | 'paszport',
                    }))}
                    className="w-full h-11 px-3 rounded-lg bg-surface-soft border border-border text-text-primary focus:outline-none focus:border-gold"
                  >
                    <option value="dowod_osobisty">Dowód osobisty</option>
                    <option value="paszport">Paszport</option>
                  </select>
                </div>
                <Input
                  label="PESEL"
                  value={daneUmowy.pesel}
                  onChange={(event) => setDaneUmowy((current) => ({
                    ...current,
                    pesel: event.target.value.replace(/\D/g, '').slice(0, 11),
                  }))}
                  inputMode="numeric"
                  hint="11 cyfr"
                  required
                />
                <Input
                  label="Numer dokumentu (opcjonalnie)"
                  value={daneUmowy.documentNumber}
                  onChange={(event) => setDaneUmowy((current) => ({
                    ...current,
                    documentNumber: event.target.value.toUpperCase(),
                  }))}
                />
                <Input
                  label="Kaucja (zł)"
                  type="number"
                  min={0}
                  value={String(daneUmowy.deposit)}
                  onChange={(event) => setDaneUmowy((current) => ({ ...current, deposit: Number(event.target.value) }))}
                />
                <div className="sm:col-span-2">
                  <Textarea
                    label="Wydawane akcesoria"
                    rows={2}
                    value={daneUmowy.accessories}
                    onChange={(event) => setDaneUmowy((current) => ({ ...current, accessories: event.target.value }))}
                    required
                  />
                </div>
              </div>
              <Button
                variant="primary"
                className="w-full"
                disabled={zapisywanie}
                onClick={() => void przygotujUmowe()}
              >
                {zapisywanie ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileSignature className="w-4 h-4 mr-2" />}
                Przygotuj umowę do podpisu
              </Button>
            </Card>
          ) : !umowa ? (
            <Card variant="glass" className="p-8 flex justify-center">
              <Loader2 className="w-6 h-6 text-gold animate-spin" />
            </Card>
          ) : (
            <>
              <div className="bg-white text-[#171717] shadow-[0_18px_60px_rgba(0,0,0,0.14)] border border-black/10 px-5 sm:px-10 py-8 rounded-[--radius-sm]">
                <ContractDocument snapshot={umowa.snapshot} />

                <div className="mt-10 pt-8 border-t-2 border-[#b8972a]">
                  <h2 className="text-lg font-bold text-[#8b6914] text-center">OŚWIADCZENIE I PODPISY STRON</h2>
                  <p className="text-sm text-neutral-600 leading-6 mt-3 sm:text-justify">
                    Strony oświadczają, że zapoznały się z pełną treścią powyższej umowy, dane są prawidłowe,
                    a sprzęt i akcesoria są zgodne z opisem.
                  </p>
                  <div className="mt-6 grid lg:grid-cols-2 gap-5">
                    <SignatureField
                      ref={podpisWynajmujacego}
                      title="Podpis Wynajmującego"
                      signerName={umowa.snapshot.lessor.representative}
                      ariaLabel="Pole podpisu Wynajmującego pod umową"
                      onStateChange={setMaPodpisWynajmujacego}
                    />
                    <SignatureField
                      ref={podpisNajemcy}
                      title="Podpis Najemcy"
                      signerName={umowa.snapshot.renter.name}
                      ariaLabel="Pole podpisu Najemcy pod umową"
                      onStateChange={setMaPodpisNajemcy}
                    />
                  </div>
                </div>
              </div>

              <Card variant="glass" className="p-5 space-y-3">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={zaakceptowana}
                    onChange={(event) => setZaakceptowana(event.target.checked)}
                    className="mt-1 w-4 h-4 accent-gold shrink-0"
                  />
                  <span className="text-sm text-text-secondary">
                    Klient przeczytał umowę i akceptuje wszystkie jej postanowienia.
                  </span>
                </label>
                <Button
                  variant="primary"
                  className="w-full"
                  disabled={zapisywanie || !zaakceptowana || !maPodpisWynajmujacego || !maPodpisNajemcy}
                  onClick={() => void podpiszUmowe()}
                >
                  {zapisywanie ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileSignature className="w-4 h-4 mr-2" />}
                  Podpisz umowę
                </Button>
                {(!maPodpisWynajmujacego || !maPodpisNajemcy || !zaakceptowana) && (
                  <p className="text-xs text-text-muted text-center">
                    Brakuje: {[
                      !maPodpisWynajmujacego && 'podpisu Wynajmującego',
                      !maPodpisNajemcy && 'podpisu Najemcy',
                      !zaakceptowana && 'potwierdzenia',
                    ].filter(Boolean).join(', ')}
                  </p>
                )}
              </Card>
            </>
          )}
        </div>
      </div>
    );
  }

  // === Po podpisaniu protokołu: zdjęcia i dopiero wydanie ===
  if (podpisany) {
    return (
      <div className="min-h-screen bg-bg-primary px-4 py-6 sm:py-10">
        <div className="max-w-3xl mx-auto space-y-5">
          {powrot}
          {naglowek}
          {pasekKomunikatu}

          <KrokiWydania aktywny="wydanie" />

          <Card
            variant="glass"
            className={`p-5 ${wydany ? 'border-emerald-500/30 bg-emerald-500/[0.06]' : 'border-gold/30 bg-gold/[0.05]'}`}
          >
            <div className="flex items-start gap-3">
              <CheckCircle2 className={`w-5 h-5 shrink-0 mt-0.5 ${wydany ? 'text-emerald-400 light:text-emerald-700' : 'text-gold'}`} />
              <div className="flex-1">
                <p className="font-semibold text-text-primary">
                  {wydany ? 'Sprzęt wydany klientowi' : 'Protokół podpisany'}
                </p>
                <p className="text-sm text-text-muted mt-1">
                  {view.signedAt ? `Podpisano ${new Date(view.signedAt).toLocaleString('pl-PL')}. ` : ''}
                  {wydany
                    ? 'Najem jest w toku — sprzęt jest u klienta.'
                    : 'Dokument wysłaliśmy na adres klienta. Zrób zdjęcia wydawanego sprzętu i dopiero wtedy wydaj go klientowi.'}
                </p>
                <Button variant="secondary" size="sm" className="mt-3" onClick={() => void downloadHandoverPdf(reservationId)}>
                  <Download className="w-4 h-4 mr-2" /> Pobierz protokół
                </Button>
              </div>
            </div>
          </Card>

          <Card variant="glass" className="p-5 space-y-3">
            <div className="flex items-center gap-2">
              <Camera className="w-4 h-4 text-gold" />
              <h2 className="font-semibold text-text-primary">Zdjęcia wydawanego sprzętu</h2>
            </div>
            <p className="text-xs text-text-muted">
              {wydany
                ? 'Zdjęcia zostają w dokumentacji najmu — przy zwrocie porównacie z nimi stan sprzętu.'
                : 'Zrób zdjęcia sprzętu w chwili wydania. Bez nich nie da się wydać sprzętu — to jedyny dowód, w jakim stanie opuścił wypożyczalnię.'}
            </p>
            <HandoverPhotos
              reservationId={reservationId}
              takenBy={snapshot.employeeName}
              phases={['before']}
              onCountChange={(liczby) => setZdjecPrzed(liczby.before)}
              onNotify={(tekst, ton) => {
                powiadom(tekst, ton);
                void wczytaj();
              }}
            />
          </Card>

          {!wydany && (
            <Card variant="glass" className="p-5 space-y-3">
              <h2 className="font-semibold text-text-primary">Wydanie sprzętu</h2>
              {!view.canRelease && view.releaseBlockedReason && (
                <p className="text-xs text-amber-400 light:text-amber-800 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  {view.releaseBlockedReason}
                </p>
              )}

              {/* Klient stoi przy ladzie, więc płatność da się przyjąć od razu:
                  gotówką, terminalem albo linkiem, który otworzy na telefonie. */}
              {czekaNaPlatnosc && (
                <div className="pt-1 space-y-3">
                  <PaymentLinkPanel
                    reservationId={reservationId}
                    onNotify={(tekst, ton) => {
                      powiadom(tekst, ton);
                      void wczytaj();
                    }}
                  />
                </div>
              )}

              <Button
                variant="primary"
                className="w-full"
                disabled={zapisywanie || !view.canRelease}
                onClick={() => void wydaj()}
              >
                {zapisywanie ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <PackageCheck className="w-4 h-4 mr-2" />}
                Wydaj sprzęt
              </Button>
              <p className="text-xs text-text-muted text-center">
                Dopiero to przekazuje sprzęt klientowi w systemie i rozpoczyna najem.
              </p>
            </Card>
          )}

          <HandoverDocument snapshot={snapshot} />

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

          <KrokiWydania aktywny="protokol" />

          <Card variant="glass" className="p-4 border-gold/30 bg-gold/[0.05]">
            <p className="text-sm text-text-primary">
              <strong>Pokaż ten dokument klientowi.</strong> Poniżej jest pełna treść protokołu w wersji, którą
              obie Strony podpisują. Jeśli coś wymaga poprawki, wróć do danych — po podpisaniu nic już nie da
              się zmienić.
            </p>
          </Card>

          <HandoverDocument snapshot={snapshot} />

          {snapshot.photoCount === 0 && (
            <Card variant="glass" className="p-4">
              <p className="text-xs text-text-muted">
                Dokument stwierdza brak zdjęć. Jeśli chcesz je dołączyć, wróć do danych — liczba zdjęć jest
                częścią treści, którą podpisujecie.
              </p>
            </Card>
          )}

          {!view.canSign && (
            <Card variant="glass" className="p-4 border-amber-500/30 bg-amber-500/[0.06]">
              <p className="text-sm text-amber-300 light:text-amber-700 flex items-start gap-2">
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
                title="Podpis wydającego"
                signerName={snapshot.employeeName || 'Wynajmujący'}
                ariaLabel="Pole podpisu wydającego"
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
              <p className="text-xs text-amber-300 light:text-amber-700">
                Do podpisania brakuje:{' '}
                {[!maPodpisPracownika && 'podpis wydającego', !maPodpisKlienta && 'podpis klienta']
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
              Podpis zamyka dokument. Sprzęt wydacie w następnym kroku, po zdjęciach.
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

        <KrokiWydania aktywny="protokol" />

        {!view.canSign && (
          <Card variant="glass" className="p-4 border-amber-500/30 bg-amber-500/[0.06]">
            <p className="text-sm text-amber-300 light:text-amber-700 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              {view.blockedReason}
            </p>
          </Card>
        )}

        <Card variant="glass" className="p-5 space-y-3">
          <h2 className="font-semibold text-text-primary">Dane wydania</h2>
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
              <dt className="text-text-muted">Okres najmu</dt>
              <dd className="text-text-primary">
                {snapshot.rental.isIndefinite || !snapshot.rental.endDate
                  ? `od ${polishDate(snapshot.rental.startDate)}, godz. ${snapshot.rental.startTime} — bezterminowo`
                  : `${polishDate(snapshot.rental.startDate)} ${snapshot.rental.startTime} → ${polishDate(snapshot.rental.endDate)} ${snapshot.rental.endTime}`}
              </dd>
            </div>
            <div>
              <dt className="text-text-muted">Miejsce wydania</dt>
              <dd className="text-text-primary">{snapshot.place}</dd>
            </div>
          </dl>
        </Card>

        <Card variant="glass" className="p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4 text-gold" />
            <h2 className="font-semibold text-text-primary">Wydawany sprzęt</h2>
          </div>
          <p className="text-xs text-text-muted">
            Lista pochodzi z umowy. Popraw ją, jeśli wydajesz coś innego — protokół ma opisywać to, co
            faktycznie trafia do klienta.
          </p>

          <div className="space-y-2">
            {pozycje.map((pozycja, index) => (
              <div key={index} className="flex gap-2">
                <Input
                  value={pozycja}
                  aria-label={`Pozycja ${index + 1}`}
                  onChange={(event) =>
                    setPozycje((lista) => lista.map((wartosc, i) => (i === index ? event.target.value : wartosc)))
                  }
                />
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={`Usuń pozycję ${index + 1}`}
                  onClick={() => setPozycje((lista) => lista.filter((_, i) => i !== index))}
                  className="text-red-400 light:text-red-700 hover:text-red-300 light:text-red-700 shrink-0"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
            <Button variant="ghost" size="sm" onClick={() => setPozycje((lista) => [...lista, ''])}>
              <Plus className="w-4 h-4 mr-1.5" /> Dodaj pozycję
            </Button>
          </div>

          {snapshot.accessories && snapshot.accessories.toLowerCase() !== 'brak' && (
            <p className="text-sm text-text-secondary">
              <span className="text-text-muted">Dodatkowe akcesoria: </span>
              {snapshot.accessories}
            </p>
          )}
        </Card>

        <Card variant="glass" className="p-5 space-y-3">
          <h2 className="font-semibold text-text-primary">Stan sprzętu przy wydaniu</h2>
          <Textarea
            value={stan}
            rows={4}
            onChange={(event) => setStan(event.target.value)}
            placeholder="Opisz stan: zarysowania, ślady zużycia, brakujące elementy, uwagi klienta…"
            aria-label="Stan sprzętu przy wydaniu"
          />
          <p className="text-xs text-text-muted">
            Wpisz też uwagi zgłoszone przez klienta. To ten opis rozstrzyga przy zwrocie, co było
            uszkodzone wcześniej.
          </p>
        </Card>

        <Card variant="glass" className="p-5 space-y-3">
          <h2 className="font-semibold text-text-primary">Zdjęcia przed wydaniem</h2>
          <p className="text-xs text-text-muted">
            {zdjecPrzed > 0
              ? `${zdjecPrzed} zdjęć trafi do treści protokołu. Dodaj wszystkie teraz — liczba zdjęć jest częścią podpisywanego dokumentu.`
              : 'Zdjęcia nie są wymagane, ale bez nich trudno dowieść stanu sprzętu przy wydaniu. Dodaj je przed wygenerowaniem protokołu.'}
          </p>
          <HandoverPhotos
            reservationId={reservationId}
            takenBy={wydajacy}
            phases={['before']}
            onCountChange={(liczby) => setZdjecPrzed(liczby.before)}
            onNotify={(tekst, ton) => powiadom(tekst, ton)}
          />
        </Card>

        <Card variant="glass" className="p-5 space-y-4">
          <h2 className="font-semibold text-text-primary">Wydający</h2>
          <Input
            label="Imię i nazwisko"
            value={wydajacy}
            onChange={(event) => setWydajacy(event.target.value)}
            placeholder="np. Kamil Kida"
          />

          {braki.length > 0 && (
            <p className="text-xs text-amber-300 light:text-amber-700">Do wygenerowania protokołu brakuje: {braki.join(', ')}.</p>
          )}

          <Button
            variant="primary"
            className="w-full"
            disabled={zapisywanie || braki.length > 0}
            onClick={() => void generuj()}
          >
            {zapisywanie ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileText className="w-4 h-4 mr-2" />}
            Generuj protokół
          </Button>
          <p className="text-xs text-text-muted text-center">
            Zobaczysz pełną treść dokumentu. Podpisy składacie dopiero pod nią.
          </p>
        </Card>

        <div className="pb-8">{linkDoPanelu}</div>
      </div>
    </div>
  );
}

/** Wydanie to jedna droga: umowa, płatność, protokół, zdjęcia. Pasek mówi, gdzie jesteśmy. */
function KrokiWydania({ aktywny }: { aktywny: 'umowa' | 'protokol' | 'wydanie' }) {
  const kroki: Array<{ klucz: 'umowa' | 'protokol' | 'wydanie'; etykieta: string }> = [
    { klucz: 'umowa', etykieta: 'Umowa najmu' },
    { klucz: 'protokol', etykieta: 'Protokół wydania' },
    { klucz: 'wydanie', etykieta: 'Płatność i wydanie' },
  ];
  const biezacy = kroki.findIndex((krok) => krok.klucz === aktywny);
  return (
    <ol className="flex items-center gap-2 text-xs">
      {kroki.map((krok, index) => {
        const zrobiony = index < biezacy;
        const teraz = index === biezacy;
        return (
          <li key={krok.klucz} className="flex items-center gap-2 min-w-0">
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-[--radius-sm] border whitespace-nowrap ${
                teraz
                  ? 'border-gold/50 bg-gold/10 text-gold font-medium'
                  : zrobiony
                    ? 'border-emerald-500/30 text-emerald-400 light:text-emerald-700'
                    : 'border-border text-text-muted'
              }`}
            >
              {zrobiony ? <Check className="w-3.5 h-3.5" /> : <span className="tabular-nums">{index + 1}.</span>}
              <span className="hidden sm:inline">{krok.etykieta}</span>
            </span>
            {index < kroki.length - 1 && <span className="text-text-muted">›</span>}
          </li>
        );
      })}
    </ol>
  );
}

export default HandoverProtocolPage;
