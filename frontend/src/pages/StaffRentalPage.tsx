import { useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Copy,
  ExternalLink,
  FileSignature,
  Loader2,
  Package,
  User,
} from 'lucide-react';
import { Button, Card, Input, Select, Textarea } from '@/components/ui';
import { products, getProductById, calculateRentalCost } from '@/data/products';
import { submitReservation, type ReservationPayload } from '@/services/api';
import {
  createContractSession,
  isAdminLoggedIn,
  type CreateContractPayload,
} from '@/services/adminApi';

const todayLocal = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

interface RentalForm {
  productId: string;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  delivery: boolean;
  city: string;
  deliveryAddress: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  company: string;
  notes: string;
  wantsInvoice: boolean;
  invoiceNip: string;
  invoiceCompany: string;
  invoiceAddress: string;
  renterAddress: string;
  documentType: 'dowod_osobisty' | 'paszport';
  documentNumber: string;
  pesel: string;
  employeeName: string;
  deposit: number;
  accessories: string;
  conditionNotes: string;
}

const initialForm: RentalForm = {
  productId: '',
  startDate: todayLocal(),
  endDate: todayLocal(),
  startTime: '09:00',
  endTime: '09:00',
  delivery: false,
  city: 'Rzeszów',
  deliveryAddress: '',
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  company: '',
  notes: '',
  wantsInvoice: false,
  invoiceNip: '',
  invoiceCompany: '',
  invoiceAddress: '',
  renterAddress: '',
  documentType: 'dowod_osobisty',
  documentNumber: '',
  pesel: '',
  employeeName: localStorage.getItem('wb-rent-employee-name') || '',
  deposit: 300,
  accessories: '',
  conditionNotes: 'Sprzęt sprawny, kompletny, bez widocznych uszkodzeń.',
};

export function StaffRentalPage() {
  const [form, setForm] = useState<RentalForm>(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [session, setSession] = useState<{
    reservationId: number;
    contractNumber: string;
    signingUrl: string;
    expiresAt: string;
  } | null>(null);

  const selectedProduct = getProductById(form.productId);

  const price = useMemo(() => {
    if (!selectedProduct || !form.startDate || !form.endDate) return null;
    const diff = Math.round((Date.parse(form.endDate) - Date.parse(form.startDate)) / 86_400_000);
    const [sh, sm] = form.startTime.split(':').map(Number);
    const [eh, em] = form.endTime.split(':').map(Number);
    const extra = eh * 60 + em > sh * 60 + sm ? 1 : 0;
    const days = Math.max(1, diff + extra);
    const pickupDay = new Date(`${form.startDate}T12:00:00`).getDay();
    const cost = calculateRentalCost(
      selectedProduct.id,
      days,
      form.delivery,
      pickupDay === 5 && days <= 3,
      pickupDay === 0 || pickupDay === 6
    );
    if (!cost) return null;
    return {
      days,
      base: cost.basePrice,
      deliveryFee: cost.deliveryFee,
      weekendFee: cost.weekendPickupFee,
      total: cost.total,
    };
  }, [selectedProduct, form.startDate, form.endDate, form.startTime, form.endTime, form.delivery]);

  if (!isAdminLoggedIn()) return <Navigate to="/admin" replace />;

  const update = <K extends keyof RentalForm>(key: K, value: RentalForm[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedProduct || !price) return;
    if (form.endDate < form.startDate) {
      setError('Data zwrotu nie może być wcześniejsza niż data odbioru.');
      return;
    }
    if (form.delivery && form.deliveryAddress.trim().length < 5) {
      setError('Podaj pełny adres dostawy.');
      return;
    }
    setSubmitting(true);
    setError('');

    const payload: ReservationPayload = {
      productId: selectedProduct.id,
      productName: selectedProduct.name,
      categoryId: selectedProduct.categoryId,
      startDate: form.startDate,
      endDate: form.endDate,
      startTime: form.startTime,
      endTime: form.endTime,
      days: price.days,
      delivery: form.delivery,
      city: form.city,
      address: form.delivery ? form.deliveryAddress : undefined,
      weekendPickup: [0, 6].includes(new Date(`${form.startDate}T12:00:00`).getDay()),
      firstName: form.firstName,
      lastName: form.lastName,
      email: form.email,
      phone: form.phone,
      company: form.company || undefined,
      wantsInvoice: form.wantsInvoice,
      invoiceNip: form.invoiceNip || undefined,
      invoiceCompany: form.invoiceCompany || undefined,
      invoiceAddress: form.invoiceAddress || undefined,
      notes: form.notes || undefined,
      totalPrice: price.total,
    };

    const reservation = await submitReservation(payload);
    const reservationId = reservation.data?.id;
    if (!reservation.success || !reservationId) {
      setError(reservation.error?.message || 'Nie udało się utworzyć rezerwacji.');
      setSubmitting(false);
      return;
    }

    const contractPayload: CreateContractPayload = {
      reservationId,
      renterAddress: form.renterAddress,
      documentType: form.documentType,
      documentNumber: form.documentNumber,
      pesel: form.pesel || undefined,
      employeeName: form.employeeName,
      deposit: Number(form.deposit),
      accessories: form.accessories,
      conditionNotes: form.conditionNotes,
    };
    const contract = await createContractSession(contractPayload);
    if (!contract.success || !contract.data) {
      setError(
        `Rezerwacja #${reservationId} została utworzona, ale nie udało się przygotować umowy: ${contract.message || 'błąd serwera'}`
      );
      setSubmitting(false);
      return;
    }

    localStorage.setItem('wb-rent-employee-name', form.employeeName);
    setSession({ reservationId, ...contract.data });
    setSubmitting(false);
  };

  if (session) {
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center px-4 py-12">
        <Card variant="glass" className="max-w-xl w-full p-8 text-center">
          <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-5" />
          <h1 className="text-2xl font-bold">Wynajem i umowa gotowe</h1>
          <p className="text-text-secondary mt-2">
            Rezerwacja #{session.reservationId} • {session.contractNumber}
          </p>
          <p className="text-sm text-text-muted mt-2 mb-6">
            Przekaż urządzenie klientowi. Po podpisaniu system wygeneruje PDF, wyśle e-mail i uruchomi płatność.
          </p>
          <div className="p-3 rounded-lg bg-bg-secondary border border-border text-left text-xs text-text-secondary break-all mb-6">
            {session.signingUrl}
          </div>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button variant="primary" onClick={() => window.open(session.signingUrl, '_blank', 'noopener,noreferrer')}>
              <ExternalLink className="w-4 h-4 mr-2" /> Uruchom ekran podpisu
            </Button>
            <Button
              variant="secondary"
              onClick={async () => {
                await navigator.clipboard.writeText(session.signingUrl);
              }}
            >
              <Copy className="w-4 h-4 mr-2" /> Kopiuj link
            </Button>
          </div>
          <Link to="/admin" className="inline-block mt-7 text-sm text-text-muted hover:text-gold">
            Wróć do panelu
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-primary px-4 py-8">
      <main className="max-w-5xl mx-auto">
        <Link to="/admin" className="inline-flex items-center gap-2 text-text-secondary hover:text-gold mb-6">
          <ArrowLeft className="w-4 h-4" /> Panel admina
        </Link>
        <div className="mb-8">
          <p className="text-gold text-sm uppercase tracking-wider">Tryb obsługi przy ladzie</p>
          <h1 className="text-3xl font-bold mt-1">Nowy wynajem i umowa</h1>
          <p className="text-text-secondary mt-2">
            Wypełnij dane razem z klientem. Następny ekran pokaże kompletną umowę do podpisania.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="grid lg:grid-cols-[1fr_340px] gap-6 items-start">
          <div className="space-y-6">
            <FormCard icon={<Package className="w-5 h-5" />} title="Sprzęt i termin">
              <Select
                label="Urządzenie"
                value={form.productId}
                onChange={(event) => {
                  const product = getProductById(event.target.value);
                  setForm((current) => ({
                    ...current,
                    productId: event.target.value,
                    accessories: product?.includedAccessories.join(', ') || 'Standardowe wyposażenie urządzenia',
                  }));
                }}
                options={products.map((product) => ({ value: product.id, label: `${product.name} — ${product.pricePerDay} zł/doba` }))}
                placeholder="Wybierz urządzenie"
                required
              />
              <div className="grid sm:grid-cols-2 gap-4 mt-4">
                <Input label="Data odbioru" type="date" min={todayLocal()} value={form.startDate} onChange={(event) => update('startDate', event.target.value)} required />
                <Input label="Godzina odbioru" type="time" value={form.startTime} onChange={(event) => update('startTime', event.target.value)} required />
                <Input label="Data zwrotu" type="date" min={form.startDate} value={form.endDate} onChange={(event) => update('endDate', event.target.value)} required />
                <Input label="Godzina zwrotu" type="time" value={form.endTime} onChange={(event) => update('endTime', event.target.value)} required />
              </div>
              <label className="flex items-center gap-3 mt-4 text-sm text-text-secondary">
                <input type="checkbox" checked={form.delivery} onChange={(event) => update('delivery', event.target.checked)} className="w-5 h-5 accent-gold" />
                Dostawa i odbiór pod adresem klienta (+40 zł)
              </label>
              {form.delivery && (
                <div className="grid sm:grid-cols-2 gap-4 mt-4">
                  <Input label="Miasto" value={form.city} onChange={(event) => update('city', event.target.value)} required />
                  <Input label="Adres dostawy" value={form.deliveryAddress} onChange={(event) => update('deliveryAddress', event.target.value)} required />
                </div>
              )}
            </FormCard>

            <FormCard icon={<User className="w-5 h-5" />} title="Dane klienta">
              <div className="grid sm:grid-cols-2 gap-4">
                <Input label="Imię" value={form.firstName} onChange={(event) => update('firstName', event.target.value)} required />
                <Input label="Nazwisko" value={form.lastName} onChange={(event) => update('lastName', event.target.value)} required />
                <Input label="E-mail" type="email" value={form.email} onChange={(event) => update('email', event.target.value)} required />
                <Input label="Telefon" type="tel" value={form.phone} onChange={(event) => update('phone', event.target.value)} required />
                <Input label="Adres zamieszkania" value={form.renterAddress} onChange={(event) => update('renterAddress', event.target.value)} required className="sm:col-span-2" />
                <Select
                  label="Rodzaj dokumentu"
                  value={form.documentType}
                  onChange={(event) => update('documentType', event.target.value as RentalForm['documentType'])}
                  options={[{ value: 'dowod_osobisty', label: 'Dowód osobisty' }, { value: 'paszport', label: 'Paszport' }]}
                  required
                />
                <Input label="Numer dokumentu" value={form.documentNumber} onChange={(event) => update('documentNumber', event.target.value.toUpperCase())} required />
                <Input label="PESEL (opcjonalnie)" value={form.pesel} onChange={(event) => update('pesel', event.target.value.replace(/\D/g, '').slice(0, 11))} inputMode="numeric" />
                <Input label="Firma (opcjonalnie)" value={form.company} onChange={(event) => update('company', event.target.value)} />
              </div>
              <label className="flex items-center gap-3 mt-4 text-sm text-text-secondary">
                <input type="checkbox" checked={form.wantsInvoice} onChange={(event) => update('wantsInvoice', event.target.checked)} className="w-5 h-5 accent-gold" />
                Faktura VAT
              </label>
              {form.wantsInvoice && (
                <div className="grid sm:grid-cols-2 gap-4 mt-4">
                  <Input label="NIP" value={form.invoiceNip} onChange={(event) => update('invoiceNip', event.target.value)} required />
                  <Input label="Nazwa firmy" value={form.invoiceCompany} onChange={(event) => update('invoiceCompany', event.target.value)} required />
                  <Input label="Adres firmy" value={form.invoiceAddress} onChange={(event) => update('invoiceAddress', event.target.value)} required className="sm:col-span-2" />
                </div>
              )}
            </FormCard>

            <FormCard icon={<FileSignature className="w-5 h-5" />} title="Umowa i wydanie">
              <div className="grid sm:grid-cols-2 gap-4">
                <Input label="Pracownik wydający" value={form.employeeName} onChange={(event) => update('employeeName', event.target.value)} required />
                <Input label="Kaucja (zł)" type="number" min={0} step="0.01" value={form.deposit} onChange={(event) => update('deposit', Number(event.target.value))} required />
              </div>
              <div className="mt-4"><Textarea label="Wydawane akcesoria" value={form.accessories} onChange={(event) => update('accessories', event.target.value)} rows={3} required /></div>
              <div className="mt-4"><Textarea label="Stan sprzętu przy wydaniu" value={form.conditionNotes} onChange={(event) => update('conditionNotes', event.target.value)} rows={3} required /></div>
              <div className="mt-4"><Textarea label="Uwagi do rezerwacji (opcjonalnie)" value={form.notes} onChange={(event) => update('notes', event.target.value)} rows={2} /></div>
            </FormCard>
          </div>

          <Card variant="glass" className="p-5 lg:sticky lg:top-6">
            <h2 className="font-semibold flex items-center gap-2"><Calendar className="w-5 h-5 text-gold" /> Podsumowanie</h2>
            {selectedProduct && price ? (
              <div className="mt-4 space-y-3 text-sm">
                <p className="font-medium text-text-primary">{selectedProduct.name}</p>
                <div className="flex justify-between text-text-secondary"><span>Liczba dób</span><span>{price.days}</span></div>
                <div className="flex justify-between text-text-secondary"><span>Najem</span><span>{price.base} zł</span></div>
                {price.deliveryFee > 0 && <div className="flex justify-between text-text-secondary"><span>Dostawa</span><span>{price.deliveryFee} zł</span></div>}
                {price.weekendFee > 0 && <div className="flex justify-between text-text-secondary"><span>Odbiór weekendowy</span><span>{price.weekendFee} zł</span></div>}
                <div className="flex justify-between text-lg font-bold text-gold pt-3 border-t border-border"><span>Razem</span><span>{price.total} zł</span></div>
                <div className="flex justify-between text-text-secondary"><span>Kaucja osobno</span><span>{form.deposit} zł</span></div>
              </div>
            ) : (
              <p className="text-sm text-text-muted mt-4">Wybierz urządzenie, aby zobaczyć wycenę.</p>
            )}
            {error && <p className="mt-4 text-sm text-red-400">{error}</p>}
            <Button type="submit" variant="primary" size="lg" className="w-full mt-5" disabled={!selectedProduct || submitting}>
              {submitting ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <FileSignature className="w-5 h-5 mr-2" />}
              {submitting ? 'Tworzenie…' : 'Utwórz i przejdź do podpisu'}
            </Button>
            <p className="text-xs text-text-muted mt-3 text-center">Płatność zostanie uruchomiona dopiero po podpisaniu umowy.</p>
          </Card>
        </form>
      </main>
    </div>
  );
}

function FormCard({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <Card variant="glass" className="p-5 sm:p-6">
      <h2 className="font-semibold text-lg flex items-center gap-2 mb-5"><span className="text-gold">{icon}</span>{title}</h2>
      {children}
    </Card>
  );
}

export default StaffRentalPage;
