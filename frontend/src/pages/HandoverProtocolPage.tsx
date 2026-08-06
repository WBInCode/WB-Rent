import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router';
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckCircle2,
  Download,
  FileSignature,
  FileText,
  Loader2,
  Package,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react';
import { Button, Card, Input, Textarea } from '@/components/ui';
import { SignatureField, type SignatureFieldHandle } from '@/components/SignatureField';
import { HandoverPhotos } from '@/components/HandoverPhotos';
import { HandoverDocument } from '@/components/HandoverDocument';
import {
  downloadHandoverPdf,
  getHandoverProtocol,
  isAdminLoggedIn,
  saveHandoverProtocol,
  signHandoverProtocol,
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
      powiadom(odpowiedz.message || 'Sprzęt wydany');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      powiadom(odpowiedz.message || 'Nie udało się podpisać protokołu', 'error');
    }
    setZapisywanie(false);
  };

  const powrot = (
    <Link to="/admin" className="inline-flex items-center gap-2 text-sm text-text-muted hover:text-gold transition-colors">
      <ArrowLeft className="w-4 h-4" /> Wróć do panelu
    </Link>
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
          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
          : 'bg-red-500/10 border-red-500/30 text-red-300'
      }`}
    >
      {komunikat.tekst}
    </div>
  );

  // === Po podpisaniu ===
  if (podpisany) {
    return (
      <div className="min-h-screen bg-bg-primary px-4 py-6 sm:py-10">
        <div className="max-w-3xl mx-auto space-y-5">
          {powrot}
          {naglowek}
          {pasekKomunikatu}

          <Card variant="glass" className="p-5 border-emerald-500/30 bg-emerald-500/[0.06]">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold text-text-primary">Protokół podpisany — sprzęt wydany</p>
                <p className="text-sm text-text-muted mt-1">
                  {view.signedAt ? `Podpisano ${new Date(view.signedAt).toLocaleString('pl-PL')}. ` : ''}
                  Dokument wysłaliśmy na adres klienta.
                </p>
                <Button variant="secondary" size="sm" className="mt-3" onClick={() => void downloadHandoverPdf(reservationId)}>
                  <Download className="w-4 h-4 mr-2" /> Pobierz protokół
                </Button>
              </div>
            </div>
          </Card>

          <HandoverDocument snapshot={snapshot} />

          <Card variant="glass" className="p-5 space-y-3">
            <h2 className="font-semibold text-text-primary">Zdjęcia sprzętu</h2>
            <p className="text-xs text-text-muted">
              Podpisany protokół odnotował {snapshot.photoCount} zdjęć. Nowe zdjęcia trafiają do dokumentacji
              najmu, ale nie zmieniają podpisanego dokumentu.
            </p>
            <HandoverPhotos
              reservationId={reservationId}
              takenBy={snapshot.employeeName}
              phases={['before']}
              onNotify={(tekst, ton) => powiadom(tekst, ton)}
            />
          </Card>

          <div className="pb-8">{powrot}</div>
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
              <p className="text-sm text-amber-300 flex items-start gap-2">
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
              <p className="text-xs text-amber-300">
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
                Podpisz i wydaj sprzęt
              </Button>
              <Button variant="ghost" disabled={zapisywanie} onClick={() => setKrok('dane')}>
                <Pencil className="w-4 h-4 mr-2" /> Popraw dane
              </Button>
            </div>
          </Card>

          <div className="pb-8">{powrot}</div>
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
            <p className="text-sm text-amber-300 flex items-start gap-2">
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
                  className="text-red-400 hover:text-red-300 shrink-0"
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
            <p className="text-xs text-amber-300">Do wygenerowania protokołu brakuje: {braki.join(', ')}.</p>
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

        <div className="pb-8">{powrot}</div>
      </div>
    </div>
  );
}

export default HandoverProtocolPage;
