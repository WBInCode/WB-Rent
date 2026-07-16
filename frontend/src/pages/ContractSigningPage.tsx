import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import SignaturePad from 'signature_pad';
import {
  ArrowLeft,
  CheckCircle2,
  CreditCard,
  Download,
  Eraser,
  FileSignature,
  Loader2,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import { Button, Card } from '@/components/ui';
import {
  getContractPreview,
  submitContractSignature,
  type ContractPreviewResponse,
  type SignContractResponse,
} from '@/services/api';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
const money = (value: number) => `${value.toFixed(2).replace('.', ',')} zł`;

export function ContractSigningPage() {
  const { token = '' } = useParams<{ token: string }>();
  const [preview, setPreview] = useState<ContractPreviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [hasReachedEnd, setHasReachedEnd] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<SignContractResponse | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const signaturePadRef = useRef<SignaturePad | null>(null);
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
    const marker = endMarkerRef.current;
    if (!marker) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setHasReachedEnd(true);
      },
      { threshold: 0.6 }
    );
    observer.observe(marker);
    return () => observer.disconnect();
  }, [preview]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !preview || preview.status === 'signed') return;

    const pad = new SignaturePad(canvas, {
      penColor: '#161616',
      backgroundColor: '#ffffff',
      minWidth: 1.2,
      maxWidth: 3.2,
      throttle: 8,
    });
    signaturePadRef.current = pad;
    const updateState = () => setHasSignature(!pad.isEmpty());
    pad.addEventListener('endStroke', updateState);

    const resize = () => {
      const data = pad.toData();
      const ratio = Math.max(window.devicePixelRatio || 1, 1);
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * ratio;
      canvas.height = 220 * ratio;
      canvas.getContext('2d')?.scale(ratio, ratio);
      pad.clear();
      if (data.length > 0) pad.fromData(data);
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);

    return () => {
      observer.disconnect();
      pad.removeEventListener('endStroke', updateState);
      pad.off();
      signaturePadRef.current = null;
    };
  }, [preview]);

  const clearSignature = () => {
    signaturePadRef.current?.clear();
    setHasSignature(false);
  };

  const handleSign = async () => {
    const pad = signaturePadRef.current;
    if (!pad || pad.isEmpty() || !accepted || !hasReachedEnd) return;
    setSubmitting(true);
    setError('');
    const response = await submitContractSignature(token, pad.toDataURL('image/png'), true);
    if (response.success && response.data) {
      setResult(response.data);
    } else {
      setError(response.error?.message || 'Nie udało się zapisać podpisu.');
    }
    setSubmitting(false);
  };

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
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-[#0a0a0a]">
        <Card variant="glass" className="max-w-lg w-full p-8 text-center">
          <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-5" />
          <h1 className="text-2xl font-bold mb-2">Umowa została podpisana</h1>
          <p className="text-text-secondary mb-2">{snapshot.contractNumber}</p>
          <p className="text-sm text-text-muted mb-7">
            Egzemplarz PDF został zapisany w systemie i wysłany na {snapshot.renter.email}.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <a href={pdfUrl} download>
              <Button variant="secondary">
                <Download className="w-4 h-4 mr-2" /> Pobierz PDF
              </Button>
            </a>
            {result?.payment?.redirectUrl && (
              <Button variant="primary" onClick={() => window.location.assign(result.payment!.redirectUrl)}>
                <CreditCard className="w-4 h-4 mr-2" /> Przejdź do płatności
              </Button>
            )}
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
            <FileSignature className="w-6 h-6 text-gold" />
            <div>
              <p className="font-bold">WB-Rent • podpis umowy</p>
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
            <p className="text-[#8b6914] font-bold text-xl">WB-Rent</p>
            <h1 className="text-2xl sm:text-3xl font-bold mt-2">UMOWA NAJMU SPRZĘTU</h1>
            <p className="text-sm text-neutral-500 mt-2">
              nr {snapshot.contractNumber} • wersja wzoru {snapshot.templateVersion}
            </p>
          </div>

          <ContractSection title="1. Strony umowy">
            <ContractRow label="Wynajmujący" value={snapshot.lessor.name} />
            <ContractRow label="Adres / NIP" value={`${snapshot.lessor.address}, NIP: ${snapshot.lessor.nip}`} />
            <ContractRow label="Reprezentowany przez" value={snapshot.lessor.representative} />
            <div className="h-3" />
            <ContractRow label="Najemca" value={snapshot.renter.name} />
            <ContractRow label="Adres" value={snapshot.renter.address} />
            <ContractRow label="E-mail / telefon" value={`${snapshot.renter.email} / ${snapshot.renter.phone}`} />
            <ContractRow
              label="Dokument"
              value={`${snapshot.renter.documentType === 'dowod_osobisty' ? 'dowód osobisty' : 'paszport'} ${snapshot.renter.documentNumber}${snapshot.renter.pesel ? `, PESEL: ${snapshot.renter.pesel}` : ''}`}
            />
          </ContractSection>

          <ContractSection title="2. Dane najmu">
            <ContractRow label="Sprzęt" value={snapshot.rental.productName} />
            <ContractRow label="Termin" value={`${snapshot.rental.startDate} ${snapshot.rental.startTime} – ${snapshot.rental.endDate} ${snapshot.rental.endTime} (${snapshot.rental.days} dni)`} />
            <ContractRow label="Czynsz najmu" value={money(snapshot.rental.totalPrice)} />
            <ContractRow label="Kaucja" value={money(snapshot.rental.deposit)} />
            <ContractRow label="Akcesoria" value={snapshot.rental.accessories} />
            <ContractRow label="Stan przy wydaniu" value={snapshot.rental.conditionNotes} />
          </ContractSection>

          <ContractSection title="3. Warunki umowy">
            <div className="space-y-5">
              {snapshot.clauses.map((clause) => (
                <article key={clause.number}>
                  <h3 className="font-bold text-sm">§ {clause.number}. {clause.title}</h3>
                  <p className="text-sm leading-6 text-neutral-700 text-justify mt-1">{clause.text}</p>
                </article>
              ))}
            </div>
          </ContractSection>

          <div ref={endMarkerRef} className="mt-10 pt-8 border-t-2 border-[#b8972a]">
            <h2 className="text-xl font-bold">4. Podpis Najemcy</h2>
            <p className="text-sm text-neutral-600 leading-6 mt-2">
              Potwierdzam, że przeczytałem(-am) pełną treść powyższej umowy, dane są prawidłowe,
              a sprzęt i akcesoria są zgodne z opisem. Akceptuję wszystkie postanowienia.
            </p>

            <div className="mt-6 border-2 border-neutral-300 bg-white rounded-lg overflow-hidden">
              <div className="px-4 py-2 bg-neutral-100 border-b text-xs text-neutral-500 flex justify-between">
                <span>Podpisz w polu poniżej palcem, rysikiem lub myszką</span>
                <button type="button" onClick={clearSignature} className="inline-flex items-center gap-1 text-red-600 font-medium">
                  <Eraser className="w-4 h-4" /> Wyczyść
                </button>
              </div>
              <canvas
                ref={canvasRef}
                className="block w-full h-[220px] touch-none cursor-crosshair"
                aria-label="Pole podpisu odręcznego"
              />
            </div>

            <label className={`mt-5 flex items-start gap-3 p-4 rounded-lg border ${hasReachedEnd ? 'border-[#b8972a]/50 bg-[#b8972a]/5' : 'border-neutral-200 bg-neutral-100'}`}>
              <input
                type="checkbox"
                checked={accepted}
                disabled={!hasReachedEnd}
                onChange={(event) => setAccepted(event.target.checked)}
                className="mt-1 w-5 h-5 accent-[#b8972a]"
              />
              <span className="text-sm leading-6">
                Oświadczam, że zapoznałem(-am) się z całą umową, akceptuję jej warunki i składam
                podpis elektroniczny jako <strong>{snapshot.renter.name}</strong>.
              </span>
            </label>

            {error && <p className="mt-4 text-sm text-red-600 font-medium">{error}</p>}

            <Button
              variant="primary"
              size="lg"
              className="w-full mt-6"
              disabled={!hasSignature || !accepted || submitting}
              onClick={handleSign}
            >
              {submitting ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <FileSignature className="w-5 h-5 mr-2" />}
              {submitting ? 'Generowanie i zapisywanie umowy…' : 'Podpisuję umowę'}
            </Button>
            <p className="text-xs text-neutral-500 text-center mt-3">
              Po podpisaniu nie będzie można zmienić treści. PDF trafi na Twój e-mail.
            </p>
          </div>
        </div>

        <Link to="/" className="inline-flex items-center gap-2 text-neutral-600 hover:text-[#8b6914] mt-6">
          <ArrowLeft className="w-4 h-4" /> Wróć bez podpisywania
        </Link>
      </main>
    </div>
  );
}

function ContractSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="text-lg font-bold text-[#8b6914] mb-4">{title}</h2>
      {children}
    </section>
  );
}

function ContractRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid sm:grid-cols-[180px_1fr] gap-1 sm:gap-4 py-1.5 text-sm border-b border-neutral-100">
      <span className="font-semibold text-neutral-500">{label}</span>
      <span>{value || '—'}</span>
    </div>
  );
}

export default ContractSigningPage;
