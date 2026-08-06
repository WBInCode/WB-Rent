import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router';
import {
  ArrowLeft,
  CheckCircle2,
  CreditCard,
  Download,
  FileSignature,
  Loader2,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import { Button, Card } from '@/components/ui';
import { SignatureField, type SignatureFieldHandle } from '@/components/SignatureField';
import { pl } from '@/utils/typography';
import {
  getContractPreview,
  submitContractSignature,
  type ContractPreviewResponse,
  type SignContractResponse,
} from '@/services/api';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
const money = (value: number) => `${value.toFixed(2).replace('.', ',')} zł`;

const polishDate = (value: string) => {
  const [year, month, day] = value.slice(0, 10).split('-');
  return day && month && year ? `${day}.${month}.${year}` : value;
};

export function ContractSigningPage() {
  const { token = '' } = useParams<{ token: string }>();
  const [preview, setPreview] = useState<ContractPreviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [hasReachedEnd, setHasReachedEnd] = useState(false);
  const [hasLessorSignature, setHasLessorSignature] = useState(false);
  const [hasRenterSignature, setHasRenterSignature] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<SignContractResponse | null>(null);
  const lessorSignatureRef = useRef<SignatureFieldHandle>(null);
  const renterSignatureRef = useRef<SignatureFieldHandle>(null);
  const endMarkerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    getContractPreview(token).then((response) => {
      if (cancelled) return;
      if (response.success && response.data) {
        setPreview(response.data);
      } else {
        setError(response.error?.message || 'Nie udało się otworzyć umowy.');
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    if (!preview) return;
    // IntersectionObserver gubi 1-pikselowy marker przy skokowym przewinięciu,
    // dlatego liczymy pozycję wprost: dotarcie do końca = marker minął dół ekranu.
    const check = () => {
      const marker = endMarkerRef.current;
      if (!marker) return;
      if (marker.getBoundingClientRect().top <= window.innerHeight) setHasReachedEnd(true);
    };
    check();
    window.addEventListener('scroll', check, { passive: true });
    window.addEventListener('resize', check);
    return () => {
      window.removeEventListener('scroll', check);
      window.removeEventListener('resize', check);
    };
  }, [preview]);

  const handleSign = async () => {
    const pads = [lessorSignatureRef.current, renterSignatureRef.current];
    if (pads.some((pad) => !pad || pad.isEmpty()) || !accepted || !hasReachedEnd) return;
    setSubmitting(true);
    setError('');
    const response = await submitContractSignature(token, {
      renterSignature: renterSignatureRef.current!.toDataURL(),
      lessorSignature: lessorSignatureRef.current!.toDataURL(),
      accepted: true,
    });
    if (response.success && response.data) {
      setResult(response.data);
    } else {
      setError(response.error?.message || 'Nie udało się zapisać podpisu.');
    }
    setSubmitting(false);
  };

  const brakujaceKroki = [
    !hasReachedEnd && 'przewiń umowę do końca',
    !hasLessorSignature && 'podpis Wynajmującego',
    !hasRenterSignature && 'podpis Najemcy',
    hasReachedEnd && !accepted && 'zaznacz oświadczenie',
  ].filter((step): step is string => Boolean(step));

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a]">
        <Loader2 className="w-12 h-12 text-gold animate-spin" />
      </div>
    );
  }

  if (error && !preview) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-[#0a0a0a]">
        <Card variant="glass" className="max-w-md w-full p-8 text-center">
          <XCircle className="w-14 h-14 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Nie można otworzyć umowy</h1>
          <p className="text-text-secondary mb-6">{error}</p>
          <Link to="/"><Button variant="secondary">Wróć na stronę</Button></Link>
        </Card>
      </div>
    );
  }

  if (!preview) return null;
  const { snapshot } = preview;
  const pdfUrl = result?.pdfUrl
    ? `${API_BASE_URL.replace(/\/$/, '')}${result.pdfUrl.replace(/^\/api/, '')}`
    : `${API_BASE_URL}/contracts/sign/${encodeURIComponent(token)}/pdf`;

  if (result || preview.status === 'signed') {
    const okresNajmu = snapshot.rental.isIndefinite
      ? `od ${snapshot.rental.startDate} godz. ${snapshot.rental.startTime} — bezterminowo`
      : `${snapshot.rental.startDate} godz. ${snapshot.rental.startTime} — ${snapshot.rental.endDate} godz. ${snapshot.rental.endTime}`;
    const pozycje = snapshot.rental.items?.length
      ? snapshot.rental.items
      : [{ productId: snapshot.rental.productId, productName: snapshot.rental.productName, itemPrice: snapshot.rental.totalPrice }];

    return (
      <div className="min-h-screen flex items-center justify-center px-4 py-10 bg-[#0a0a0a]">
        <Card variant="glass" className="max-w-lg w-full p-8">
          <div className="text-center">
            <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-5" />
            <h1 className="text-2xl font-bold mb-2">Umowa została podpisana</h1>
            <p className="text-text-secondary">{snapshot.contractNumber}</p>
            <p className="text-sm text-text-muted mt-3">
              {result && !result.emailDelivered
                ? 'Pobierz dokument poniżej — wysyłka e-mail nie powiodła się.'
                : `Dokument wysłaliśmy na ${snapshot.renter.email}.`}
            </p>
          </div>

          <div className="mt-7 p-5 rounded-[--radius-sm] bg-white/[0.03] border border-white/10 text-left">
            <p className="text-xs uppercase tracking-wider text-gold font-semibold mb-3">Podsumowanie wynajmu</p>
            <dl className="space-y-2 text-sm">
              <div>
                <dt className="text-text-muted">Sprzęt</dt>
                <dd className="text-text-primary">
                  {pozycje.map((pozycja) => (
                    <span key={pozycja.productId} className="block">{pozycja.productName}</span>
                  ))}
                </dd>
              </div>
              <div>
                <dt className="text-text-muted">Termin</dt>
                <dd className="text-text-primary">{okresNajmu}</dd>
              </div>
              <div>
                <dt className="text-text-muted">Odbiór</dt>
                <dd className="text-text-primary">
                  {snapshot.rental.delivery
                    ? `dostawa: ${snapshot.rental.deliveryAddress || 'adres wskazany w zamówieniu'}`
                    : 'odbiór osobisty — Rzeszów, ul. J. Słowackiego 24/11'}
                </dd>
              </div>
              <div className="pt-2 border-t border-white/10 flex justify-between items-baseline">
                <dt className="text-text-muted">Do zapłaty</dt>
                <dd className="text-lg font-bold text-gold">{money(snapshot.rental.totalPrice)}</dd>
              </div>
            </dl>
          </div>

          {result?.payment?.redirectUrl && (
            <Button
              variant="primary"
              size="lg"
              className="w-full mt-6"
              onClick={() => window.location.assign(result.payment!.redirectUrl)}
            >
              <CreditCard className="w-5 h-5 mr-2" /> Zapłać {money(snapshot.rental.totalPrice)}
            </Button>
          )}

          <div className="flex flex-col sm:flex-row gap-3 mt-4">
            <a href={pdfUrl} download className="flex-1">
              <Button variant="secondary" className="w-full">
                <Download className="w-4 h-4 mr-2" /> Pobierz umowę
              </Button>
            </a>
            <Link to="/" className="flex-1">
              <Button variant="ghost" className="w-full">
                <ArrowLeft className="w-4 h-4 mr-2" /> Wróć do sklepu
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#ecebe7] text-[#171717]">
      <header className="sticky top-0 z-30 bg-[#0a0a0a] text-white border-b border-gold/30">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <img src="/wb-rent-logo.svg" alt="WB-Rent" className="h-8 w-auto" />
            <div>
              <p className="font-bold">Podpis umowy</p>
              <p className="text-xs text-white/55">{snapshot.contractNumber}</p>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-2 text-xs text-green-400">
            <ShieldCheck className="w-4 h-4" /> Połączenie i dokument zabezpieczone
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-3 sm:px-6 py-6 sm:py-10">
        <div className="bg-white shadow-[0_18px_60px_rgba(0,0,0,0.14)] border border-black/10 px-5 sm:px-12 py-8 sm:py-12">
          <div className="text-center border-b border-[#b8972a] pb-6 mb-7">
            <img src="/wb-rent-logo.svg" alt="WB-Rent" className="h-16 sm:h-20 mx-auto" />
            <h1 className="text-2xl sm:text-3xl font-bold mt-3">UMOWA NAJMU SPRZĘTU</h1>
            <p className="text-sm text-neutral-500 mt-2">nr&nbsp;{snapshot.contractNumber}</p>
          </div>

          <div className="space-y-4 text-sm leading-6 text-neutral-800">
            <p>{pl(`Umowa najmu zawarta w dniu ${polishDate(snapshot.generatedAt)} r. w Rzeszowie pomiędzy:`)}</p>
            <PartyBlock lines={lessorLines(snapshot)} />
            <p>a</p>
            <PartyBlock lines={renterLines(snapshot)} />
            <p>{pl('zwanymi dalej łącznie „Stronami", o następującej treści:')}</p>
          </div>

          <div className="mt-7 space-y-6">
            {snapshot.clauses.map((clause) => (
              <article key={clause.number}>
                <h3 className="text-center font-bold text-[15px] leading-5">§{clause.number}</h3>
                <h4 className="text-center font-bold text-sm mb-2">{pl(clause.title)}</h4>
                {clause.points?.length ? (
                  <ol className="space-y-1.5 text-sm leading-6 text-neutral-700">
                    {clause.points.map((point, index) => (
                      <ClausePoint key={index} index={index} point={point} />
                    ))}
                  </ol>
                ) : (
                  <p className="text-sm leading-6 text-neutral-700 sm:text-justify">{pl(clause.text || '')}</p>
                )}
              </article>
            ))}
          </div>

          <div className="mt-10 pt-8 border-t-2 border-[#b8972a]">
            <h2 className="text-lg font-bold text-[#8b6914] text-center">OŚWIADCZENIE I PODPISY STRON</h2>
            <p className="text-sm text-neutral-600 leading-6 mt-3 sm:text-justify">
              {pl(
                'Potwierdzam, że przeczytałem(-am) pełną treść powyższej umowy, dane są prawidłowe, ' +
                'a sprzęt i akcesoria są zgodne z opisem. Akceptuję wszystkie postanowienia.'
              )}
            </p>

            <div className="mt-6 grid lg:grid-cols-2 gap-5">
              <SignatureField
                ref={lessorSignatureRef}
                title="Podpis Wynajmującego"
                signerName={snapshot.lessor.representative}
                ariaLabel="Pole podpisu Wynajmującego pod umową"
                onStateChange={setHasLessorSignature}
              />
              <SignatureField
                ref={renterSignatureRef}
                title="Podpis Najemcy"
                signerName={snapshot.renter.name}
                ariaLabel="Pole podpisu Najemcy pod umową"
                onStateChange={setHasRenterSignature}
              />
            </div>
          </div>
        </div>

        {/* Zero-height marker: gating on the signature block made the 60%
            threshold unreachable on small phones, blocking signing entirely. */}
        <div ref={endMarkerRef} aria-hidden="true" className="h-px w-full" />

        <div className="mt-8 bg-white shadow-[0_18px_60px_rgba(0,0,0,0.14)] border border-black/10 px-5 sm:px-12 py-8">
          <label className={`flex items-start gap-3 p-4 rounded-lg border ${hasReachedEnd ? 'border-[#b8972a]/50 bg-[#b8972a]/5' : 'border-neutral-200 bg-neutral-100'}`}>
            <input spellCheck={false}
              type="checkbox"
              checked={accepted}
              disabled={!hasReachedEnd}
              onChange={(event) => setAccepted(event.target.checked)}
              className="mt-1 w-5 h-5 accent-[#b8972a]"
            />
            <span className="text-sm leading-6">
              Oświadczam, że zapoznałem(-am) się z całą umową wraz z załącznikiem, akceptuję jej warunki
              i składam podpis elektroniczny jako <strong>{snapshot.renter.name}</strong>.
            </span>
          </label>

          {error && <p className="mt-4 text-sm text-red-600 font-medium">{error}</p>}

          {brakujaceKroki.length > 0 && (
            <p role="status" className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
              Aby podpisać umowę: {brakujaceKroki.join(', ')}.
            </p>
          )}

          <Button
            variant="primary"
            size="lg"
            className="w-full mt-6"
            disabled={brakujaceKroki.length > 0 || submitting}
            onClick={handleSign}
          >
            {submitting ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <FileSignature className="w-5 h-5 mr-2" />}
            {submitting ? 'Generowanie i zapisywanie umowy…' : 'Podpisuję umowę'}
          </Button>
          <p className="text-xs text-neutral-500 text-center mt-3">
            Po podpisaniu nie będzie można zmienić treści. PDF trafi na Twój e-mail.
          </p>
        </div>

        <Link to="/" className="inline-flex items-center gap-2 text-neutral-600 hover:text-[#8b6914] mt-6">
          <ArrowLeft className="w-4 h-4" /> Wróć bez podpisywania
        </Link>
      </main>
    </div>
  );
}

type Snapshot = ContractPreviewResponse['snapshot'];

const lessorLines = (snapshot: Snapshot): string[] => [
  `${snapshot.lessor.name} z siedzibą w Rzeszowie,`,
  `${snapshot.lessor.address},`,
  `NIP ${snapshot.lessor.nip},`,
  `reprezentowaną przez: ${snapshot.lessor.representative},`,
  'zwaną dalej „Wynajmującym",',
];

const renterLines = (snapshot: Snapshot): string[] => {
  const documentLabel = snapshot.renter.documentType === 'dowod_osobisty' ? 'dowodem osobistym' : 'paszportem';
  return [
    `${snapshot.renter.name},`,
    `zamieszkałym/ą: ${snapshot.renter.address},`,
    snapshot.renter.pesel ? `PESEL ${snapshot.renter.pesel},` : '',
    snapshot.renter.documentNumber
      ? `legitymującym/ą się ${documentLabel} nr ${snapshot.renter.documentNumber},`
      : '',
    `e-mail: ${snapshot.renter.email},`,
    `tel. ${snapshot.renter.phone},`,
    'zwanym/ą dalej „Najemcą",',
  ].filter(Boolean);
};

function PartyBlock({ lines }: { lines: string[] }) {
  return (
    <div>
      {lines.map((line, index) => (
        <p key={index}>{pl(line)}</p>
      ))}
    </div>
  );
}

/** One ustęp; embedded newlines become separate lines, "a) …" becomes a sub-list. */
function ClausePoint({ index, point }: { index: number; point: string }) {
  return (
    <li>
      {point.split('\n').map((line, lineIndex) => {
        const sub = /^([a-z]\))[\u00A0\s]*(.*)$/s.exec(line);
        if (sub) {
          return (
            <div key={lineIndex} className="flex gap-2 pl-7">
              <span className="shrink-0">{sub[1]}</span>
              <span>{pl(sub[2])}</span>
            </div>
          );
        }
        if (lineIndex === 0) {
          return (
            <div key={lineIndex} className="flex gap-2">
              <span className="shrink-0 w-5 tabular-nums">{index + 1}.</span>
              <span className="sm:text-justify">{pl(line)}</span>
            </div>
          );
        }
        return <div key={lineIndex} className="pl-7 sm:text-justify">{pl(line)}</div>;
      })}
    </li>
  );
}

export default ContractSigningPage;
