import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router';
import {
  ArrowLeft,
  BadgeCheck,
  Camera,
  Check,
  CheckCircle2,
  Clock3,
  Copy,
  ExternalLink,
  FileSignature,
  Layers3,
  Loader2,
  Package,
  Percent,
  Plus,
  RotateCcw,
  ShieldCheck,
  Trash2,
  Truck,
  User,
} from 'lucide-react';
import { Button, Card, Input, Select, Textarea } from '@/components/ui';
import { products, getProductById, calculateRentalCost, isCatalogLoaded, DELIVERY_FEE, WEEKEND_PICKUP_FEE } from '@/data/products';
import { type ReservationPayload } from '@/services/api';
import {
  createContractSession,
  getHandoverTemplate,
  isAdminLoggedIn,
  submitStaffReservation,
  updateReservationStatus,
  validateContractDetails,
  type CreateContractPayload,
} from '@/services/adminApi';
import { HandoverPhotos } from '@/components/HandoverPhotos';
import ThemeToggle from '@/components/ThemeToggle';

const todayLocal = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

interface RentalForm {
  productId: string;
  productIds: string[];
  startDate: string;
  endDate: string;
  isIndefinite: boolean;
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
  couponCode: string;
  /** Empty means "keep the calculated value" - kept as text so the field can be cleared. */
  manualDiscount: string;
  priceOverride: string;
  priceNote: string;
}

const initialForm: RentalForm = {
  productId: '',
  productIds: [],
  startDate: todayLocal(),
  endDate: todayLocal(),
  isIndefinite: false,
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
  deposit: 0,
  accessories: '',
  conditionNotes: 'Sprzęt sprawny, kompletny, bez widocznych uszkodzeń.',
  couponCode: '',
  manualDiscount: '',
  priceOverride: '',
  priceNote: '',
};

export function StaffRentalPage() {
  const [form, setForm] = useState<RentalForm>(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  // Załącznik nr 1 must describe what really leaves the counter, so the employee
  // can drop a hose the customer does not take before the signature is generated.
  const [handoverItems, setHandoverItems] = useState<string[]>([]);
  const [handoverEdited, setHandoverEdited] = useState(false);
  const [handoverNonce, setHandoverNonce] = useState(0);
  const [session, setSession] = useState<{
    reservationId: number;
    contractNumber: string;
    signingUrl: string;
    expiresAt: string;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (form.productIds.length === 0) {
        if (!cancelled) setHandoverItems([]);
        return;
      }
      const response = await getHandoverTemplate(form.productIds);
      if (cancelled || !response.success || !Array.isArray(response.data?.items)) return;
      setHandoverItems(response.data.items);
      setHandoverEdited(false);
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [form.productIds, handoverNonce]);

  const updateHandoverItem = (index: number, value: string) => {
    setHandoverEdited(true);
    setHandoverItems((current) => current.map((item, itemIndex) => (itemIndex === index ? value : item)));
  };
  const removeHandoverItem = (index: number) => {
    setHandoverEdited(true);
    setHandoverItems((current) => current.filter((_, itemIndex) => itemIndex !== index));
  };
  const addHandoverItem = () => {
    setHandoverEdited(true);
    setHandoverItems((current) => [...current, '']);
  };

  // "a) <urządzenie>:" jest nagłówkiem grupy - pozycje numerujemy w obrębie grupy.
  const handoverMarkers = useMemo(() => {
    let number = 0;
    return handoverItems.map((item) => {
      if (/^[a-z]\)/.test(item)) {
        number = 0;
        return '';
      }
      number += 1;
      return `${number}.`;
    });
  }, [handoverItems]);

  const selectedProducts = useMemo(() => form.productIds
    .map((productId) => getProductById(productId))
    .filter((product): product is NonNullable<typeof product> => Boolean(product)), [form.productIds]);
  const selectedProduct = selectedProducts[0];

  const price = useMemo(() => {
    if (selectedProducts.length === 0 || !form.startDate || (!form.isIndefinite && !form.endDate)) return null;
    const diff = form.isIndefinite
      ? 0
      : Math.round((Date.parse(form.endDate) - Date.parse(form.startDate)) / 86_400_000);
    const [sh, sm] = form.startTime.split(':').map(Number);
    const [eh, em] = form.endTime.split(':').map(Number);
    const extra = eh * 60 + em > sh * 60 + sm ? 1 : 0;
    const days = form.isIndefinite ? 1 : Math.max(1, diff + extra);
    const pickupDay = new Date(`${form.startDate}T12:00:00`).getDay();
    const lineItems = selectedProducts.map((product) => {
      const cost = calculateRentalCost(product.id, days, false, pickupDay === 5 && days === 3, false);
      return cost ? { product, price: cost.basePrice } : null;
    }).filter((item): item is NonNullable<typeof item> => Boolean(item));
    if (lineItems.length !== selectedProducts.length) return null;
    const base = lineItems.reduce((sum, item) => sum + item.price, 0);
    const deliveryFee = form.delivery ? DELIVERY_FEE * 2 : 0;
    const weekendFee = pickupDay === 0 || pickupDay === 6 ? WEEKEND_PICKUP_FEE : 0;
    return {
      days,
      lineItems,
      base,
      deliveryFee,
      weekendFee,
      total: base + deliveryFee + weekendFee,
    };
  }, [selectedProducts, form.startDate, form.endDate, form.isIndefinite, form.startTime, form.endTime, form.delivery]);

  // What the customer actually pays: system total, minus a manual discount,
  // or entirely replaced by a price the employee typed in.
  const finalPricing = useMemo(() => {
    if (!price) return null;
    const discount = Math.min(Math.max(Number(form.manualDiscount) || 0, 0), price.base);
    const afterDiscount = Math.max(price.total - discount, 0);
    const override = form.priceOverride.trim() === '' ? null : Math.max(Number(form.priceOverride) || 0, 0);
    return {
      discount,
      afterDiscount,
      override,
      total: override ?? afterDiscount,
      isEdited: override !== null || discount > 0,
    };
  }, [price, form.manualDiscount, form.priceOverride]);

  if (!isAdminLoggedIn()) return <Navigate to="/admin" replace />;

  const update = <K extends keyof RentalForm>(key: K, value: RentalForm[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  /**
   * The form is noValidate, so the browser never focuses the offending field.
   * On a phone the summary card sits thousands of pixels below the inputs, so
   * the message alone would be invisible.
   */
  const rejectWith = (message: string, fieldId?: string) => {
    setError(message);
    if (!fieldId) return;
    const field = document.getElementById(fieldId);
    field?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    (field as HTMLInputElement | null)?.focus({ preventScroll: true });
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedProduct || selectedProducts.length === 0 || !price) return;
    if (!form.isIndefinite && form.endDate < form.startDate) {
      rejectWith('Data zwrotu nie może być wcześniejsza niż data odbioru.', 'data-zwrotu');
      return;
    }
    if (form.delivery && form.deliveryAddress.trim().length < 5) {
      rejectWith('Podaj pełny adres dostawy.', 'adres-dostawy');
      return;
    }
    // Client fields relied on HTML `required`, which noValidate disables - a
    // rental could be created without a name or e-mail to send the contract to.
    if (form.firstName.trim().length < 2) {
      rejectWith('Podaj imię najemcy.', 'imię');
      return;
    }
    if (form.lastName.trim().length < 2) {
      rejectWith('Podaj nazwisko najemcy.', 'nazwisko');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email.trim())) {
      rejectWith('Podaj poprawny adres e-mail — na niego trafi podpisana umowa.', 'e-mail');
      return;
    }
    if (form.phone.replace(/\D/g, '').length < 9) {
      rejectWith('Podaj numer telefonu (minimum 9 cyfr).', 'telefon');
      return;
    }
    if (form.renterAddress.trim().length < 5) {
      rejectWith('Adres zamieszkania musi mieć co najmniej 5 znaków.', 'adres-zamieszkania');
      return;
    }
    if (!/^\d{11}$/.test(form.pesel)) {
      rejectWith('PESEL musi składać się dokładnie z 11 cyfr.', 'pesel');
      return;
    }
    if (form.documentNumber.trim() && !/^[\p{L}\d\s-]+$/u.test(form.documentNumber.trim())) {
      rejectWith('Numer dokumentu tożsamości może zawierać tylko litery, cyfry, spacje i myślniki.', 'numer-dokumentu-tożsamości-(opcjonalnie)');
      return;
    }
    if (form.employeeName.trim().length < 3) {
      rejectWith('Podaj imię i nazwisko pracownika wydającego.', 'pracownik-wydający');
      return;
    }
    if (form.accessories.trim().length < 2) {
      rejectWith('Wpisz wydawane akcesoria lub informację „brak”.', 'wydawane-akcesoria');
      return;
    }
    if (form.conditionNotes.trim().length < 2) {
      rejectWith('Opisz stan sprzętu przy wydaniu.', 'stan-sprzętu-przy-wydaniu');
      return;
    }
    const cleanedHandover = handoverItems.map((item) => item.trim()).filter(Boolean);
    if (cleanedHandover.length === 0) {
      rejectWith('Protokół wydania musi zawierać co najmniej jedną pozycję.', 'protokol-wydania-1');
      return;
    }
    const tooShort = cleanedHandover.findIndex((item) => item.length < 2);
    if (tooShort >= 0) {
      rejectWith(`Pozycja ${tooShort + 1} protokołu wydania jest za krótka.`, `protokol-wydania-${tooShort + 1}`);
      return;
    }
    setSubmitting(true);
    setError('');

    // Validate every contract field server-side before creating the reservation.
    // This prevents an orphan reservation when contract data is incomplete.
    const contractDetails: Omit<CreateContractPayload, 'reservationId'> = {
      renterAddress: form.renterAddress.trim(),
      documentType: form.documentType,
      documentNumber: form.documentNumber.trim(),
      pesel: form.pesel,
      employeeName: form.employeeName.trim(),
      deposit: Number(form.deposit),
      accessories: form.accessories.trim(),
      conditionNotes: form.conditionNotes.trim(),
      handoverItems: cleanedHandover,
    };
    const preflight = await validateContractDetails(contractDetails);
    if (!preflight.success) {
      setError(preflight.message || 'Sprawdź dane potrzebne do umowy.');
      setSubmitting(false);
      return;
    }

    const payload: ReservationPayload = {
      productId: selectedProduct.id,
      productIds: selectedProducts.map((product) => product.id),
      productName: selectedProduct.name,
      categoryId: selectedProduct.categoryId,
      startDate: form.startDate,
      endDate: form.isIndefinite ? '' : form.endDate,
      isIndefinite: form.isIndefinite,
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
      couponCode: form.couponCode.trim() ? form.couponCode.trim().toUpperCase() : undefined,
      staffPricing: {
        priceOverride: finalPricing?.override ?? undefined,
        discountAmount: finalPricing && finalPricing.discount > 0 ? finalPricing.discount : undefined,
        note: form.priceNote.trim(),
        setBy: form.employeeName.trim(),
      },
      totalPrice: finalPricing?.total ?? price.total,
    };

    const reservation = await submitStaffReservation(payload);
    // The public endpoint returns the id at the top level, not inside `data`.
    const reservationId = reservation.id ?? reservation.data?.id;
    if (!reservation.success || !reservationId) {
      setError(reservation.message || 'Nie udało się utworzyć rezerwacji.');
      setSubmitting(false);
      return;
    }

    const contractPayload: CreateContractPayload = {
      reservationId,
      ...contractDetails,
    };
    const contract = await createContractSession(contractPayload);
    if (!contract.success || !contract.data) {
      // Compensation: release the availability slot if the second stage fails
      // despite successful preflight (e.g. transient DB/network error).
      await updateReservationStatus(reservationId, 'cancelled').catch(() => undefined);
      setError(
        `Nie udało się przygotować umowy. Rezerwacja #${reservationId} została automatycznie anulowana: ${contract.message || 'błąd serwera'}`
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
        <Card variant="glass" className="max-w-xl w-full p-8">
          <div className="text-center">
            <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-5" />
            <h1 className="text-2xl font-bold">Wynajem i umowa gotowe</h1>
            <p className="text-text-secondary mt-2">
              Rezerwacja #{session.reservationId} • {session.contractNumber}
            </p>
            <p className="text-sm text-text-muted mt-2 mb-6">
              Przekaż urządzenie klientowi. Po podpisaniu system wygeneruje PDF, wyśle e-mail i uruchomi płatność.
            </p>
          </div>
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

          <div className="mt-8 pt-6 border-t border-border">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <Package className="w-4 h-4 text-gold" /> Następny krok: wydanie sprzętu
            </h2>
            <p className="text-xs text-text-muted mt-1 mb-4">
              Po podpisaniu umowy i opłaceniu najmu otwórz protokół wydania — tam dodasz zdjęcia stanu,
              uwagi i zbierzesz oba podpisy. Podpisany protokół oznacza sprzęt jako wydany.
            </p>
            <Link to={`/admin/wydanie/${session.reservationId}`}>
              <Button variant="secondary" className="w-full">
                <FileSignature className="w-4 h-4 mr-2" /> Otwórz protokół wydania
              </Button>
            </Link>
          </div>

          <div className="mt-8 pt-6 border-t border-border">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <Camera className="w-4 h-4 text-gold" /> Dokumentacja stanu sprzętu
            </h2>
            <p className="text-xs text-text-muted mt-1 mb-4">
              Zrób zdjęcia przy wydaniu, a po zwrocie uzupełnij je drugą serią. Zapisują się przy rezerwacji.
            </p>
            <HandoverPhotos
              reservationId={session.reservationId}
              takenBy={form.employeeName}
              onNotify={(message, tone) => setError(tone === 'error' ? message : '')}
            />
            {error && (
              <p className="mt-3 text-sm text-red-300 light:text-red-700">{error}</p>
            )}
          </div>

          <div className="text-center">
            <Link to="/admin" className="inline-block mt-7 text-sm text-text-muted hover:text-gold">
              Wróć do panelu
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-primary text-text-primary">
      <div className="border-b border-border bg-bg-secondary">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between gap-4">
          <Link to="/admin" className="inline-flex items-center gap-2 text-sm text-text-secondary hover:text-gold transition-colors">
            <ArrowLeft className="w-4 h-4" /> Panel admina
          </Link>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 text-xs text-text-muted">
              <ShieldCheck className="w-4 h-4 text-green-500" /> Tryb bezpiecznej obsługi klienta
            </div>
            <ThemeToggle className="h-9 w-9" />
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
        <header className="grid lg:grid-cols-[1fr_auto] gap-6 items-end mb-9">
          <div>
            <div className="inline-flex items-center gap-2 text-gold text-xs font-semibold uppercase tracking-[0.16em] mb-3">
              <BadgeCheck className="w-4 h-4" /> Obsługa przy ladzie
            </div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold leading-tight">Nowy wynajem</h1>
            <p className="text-text-secondary mt-3 max-w-2xl text-base lg:text-lg">
              Wybierzcie sprzęt razem, ustalcie termin i uzupełnijcie dane. Na końcu obie strony podpiszą gotową umowę.
            </p>
          </div>
          <div className="flex items-center gap-1.5 text-xs sm:text-sm" aria-label="Etapy procesu">
            <ProcessStep number="1" label="Sprzęt" active />
            <span className="w-5 sm:w-8 h-px bg-border" />
            <ProcessStep number="2" label="Klient" />
            <span className="w-5 sm:w-8 h-px bg-border" />
            <ProcessStep number="3" label="Umowa" />
          </div>
        </header>

        <form noValidate onSubmit={handleSubmit} className="space-y-7">
          <ProductCatalog
            selectedIds={form.productIds}
            onToggle={(productId) => {
              setForm((current) => ({
                ...current,
                ...(() => {
                  const productIds = current.productIds.includes(productId)
                    ? current.productIds.filter((id) => id !== productId)
                    : [...current.productIds, productId];
                  const includedAccessories = productIds.flatMap((id) =>
                    getProductById(id)?.includedAccessories || []
                  );
                  return {
                    productIds,
                    productId: productIds[0] || '',
                    accessories: includedAccessories.length > 0
                      ? [...new Set(includedAccessories)].join(', ')
                      : 'Standardowe wyposażenie urządzeń',
                  };
                })(),
              }));
            }}
          />

          <div className="grid xl:grid-cols-[minmax(0,1fr)_380px] gap-7 items-start">
            <div className="space-y-6">
              <FormCard number="1" icon={<Clock3 className="w-5 h-5" />} title="Termin i sposób odbioru" description="Ustal dokładny czas wydania oraz zwrotu urządzenia.">
                <label className={`mb-5 flex items-center justify-between gap-4 p-4 rounded-lg border cursor-pointer transition-colors ${form.isIndefinite ? 'border-gold/50 bg-gold/10' : 'border-border bg-bg-primary/40 hover:border-border-hover'}`}>
                  <span>
                    <span className="block text-sm font-semibold text-text-primary">Wynajem bezterminowy</span>
                    <span className="block text-xs text-text-muted mt-0.5">Bez planowanej daty zwrotu, rozliczany według faktycznego czasu najmu</span>
                  </span>
                  <input
                    type="checkbox"
                    role="switch"
                    checked={form.isIndefinite}
                    onChange={(event) => update('isIndefinite', event.target.checked)}
                    className="w-5 h-5 accent-gold shrink-0"
                  />
                </label>
                <div className="grid sm:grid-cols-2 gap-4">
                  <Input label="Data odbioru" type="date" min={todayLocal()} value={form.startDate} onChange={(event) => update('startDate', event.target.value)} required />
                  <Input label="Godzina odbioru" type="time" value={form.startTime} onChange={(event) => update('startTime', event.target.value)} required />
                  {!form.isIndefinite && (
                    <>
                      <Input label="Data zwrotu" type="date" min={form.startDate} value={form.endDate} onChange={(event) => update('endDate', event.target.value)} required />
                      <Input label="Godzina zwrotu" type="time" value={form.endTime} onChange={(event) => update('endTime', event.target.value)} required />
                    </>
                  )}
                </div>
                {form.isIndefinite && (
                  <div className="mt-4 p-3 rounded-lg border border-amber-500/25 bg-amber-500/[0.07] text-xs text-amber-200">
                    Sprzęt pozostanie niedostępny dla kolejnych rezerwacji do czasu ustalenia terminu i zwrotu.
                  </div>
                )}

                <div className="grid sm:grid-cols-2 gap-3 mt-5" role="radiogroup" aria-label="Sposób odbioru">
                  <PickupOption
                    selected={!form.delivery}
                    icon={<Package className="w-5 h-5" />}
                    title="Odbiór osobisty"
                    description="Klient odbiera i zwraca sprzęt w punkcie"
                    onClick={() => update('delivery', false)}
                  />
                  <PickupOption
                    selected={form.delivery}
                    icon={<Truck className="w-5 h-5" />}
                    title="Dostawa i odbiór"
                    description="Transport pod wskazany adres • +40 zł"
                    onClick={() => update('delivery', true)}
                  />
                </div>
                {form.delivery && (
                  <div className="grid sm:grid-cols-2 gap-4 mt-4 p-4 rounded-lg bg-gold/5 border border-gold/20">
                    <Input label="Miasto" value={form.city} onChange={(event) => update('city', event.target.value)} required />
                    <Input label="Adres dostawy" value={form.deliveryAddress} onChange={(event) => update('deliveryAddress', event.target.value)} required />
                  </div>
                )}
              </FormCard>

              <FormCard number="2" icon={<User className="w-5 h-5" />} title="Dane klienta" description="Przepisz dane dokładnie z dokumentu tożsamości.">
                <div className="grid sm:grid-cols-2 gap-4">
                  <Input label="Imię" value={form.firstName} onChange={(event) => update('firstName', event.target.value)} required />
                  <Input label="Nazwisko" value={form.lastName} onChange={(event) => update('lastName', event.target.value)} required />
                  <Input label="E-mail" type="email" value={form.email} onChange={(event) => update('email', event.target.value)} required />
                  <Input label="Telefon" type="tel" value={form.phone} onChange={(event) => update('phone', event.target.value)} required />
                  <div className="sm:col-span-2">
                    <Input label="Adres zamieszkania" value={form.renterAddress} onChange={(event) => update('renterAddress', event.target.value)} required />
                  </div>
                  <Select
                    label="Rodzaj dokumentu"
                    value={form.documentType}
                    onChange={(event) => update('documentType', event.target.value as RentalForm['documentType'])}
                    options={[{ value: 'dowod_osobisty', label: 'Dowód osobisty' }, { value: 'paszport', label: 'Paszport' }]}
                    required
                  />
                  <Input
                    label="PESEL"
                    value={form.pesel}
                    onChange={(event) => update('pesel', event.target.value.replace(/\D/g, '').slice(0, 11))}
                    inputMode="numeric"
                    minLength={11}
                    maxLength={11}
                    pattern="[0-9]{11}"
                    hint="11 cyfr"
                    required
                  />
                  <Input
                    label="Numer dokumentu tożsamości (opcjonalnie)"
                    value={form.documentNumber}
                    onChange={(event) => update('documentNumber', event.target.value.toUpperCase())}
                    maxLength={30}
                    hint="Np. ABC 123456"
                  />
                  <Input label="Firma (opcjonalnie)" value={form.company} onChange={(event) => update('company', event.target.value)} />
                </div>

                <label className={`mt-5 flex items-center justify-between gap-4 p-4 rounded-lg border cursor-pointer transition-colors ${form.wantsInvoice ? 'border-gold/50 bg-gold/10' : 'border-border bg-bg-primary/40 hover:border-border-hover'}`}>
                  <span>
                    <span className="block text-sm font-semibold text-text-primary">Faktura VAT</span>
                    <span className="block text-xs text-text-muted mt-0.5">Uzupełnij dane nabywcy do faktury</span>
                  </span>
                  <input type="checkbox" checked={form.wantsInvoice} onChange={(event) => update('wantsInvoice', event.target.checked)} className="w-5 h-5 accent-gold" />
                </label>
                {form.wantsInvoice && (
                  <div className="grid sm:grid-cols-2 gap-4 mt-4 p-4 rounded-lg bg-gold/5 border border-gold/20">
                    <Input label="NIP" value={form.invoiceNip} onChange={(event) => update('invoiceNip', event.target.value)} required />
                    <Input label="Nazwa firmy" value={form.invoiceCompany} onChange={(event) => update('invoiceCompany', event.target.value)} required />
                    <div className="sm:col-span-2"><Input label="Adres firmy" value={form.invoiceAddress} onChange={(event) => update('invoiceAddress', event.target.value)} required /></div>
                  </div>
                )}
              </FormCard>

              <FormCard number="3" icon={<FileSignature className="w-5 h-5" />} title="Umowa i wydanie" description="Potwierdź wyposażenie, stan sprzętu i wysokość kaucji.">
                <div className="grid sm:grid-cols-2 gap-4">
                  <Input label="Pracownik wydający" value={form.employeeName} onChange={(event) => update('employeeName', event.target.value)} required />
                  <Input label="Kaucja (zł)" type="number" min={0} step="0.01" value={form.deposit} onChange={(event) => update('deposit', Number(event.target.value))} required />
                </div>
                <div className="mt-4"><Textarea label="Wydawane akcesoria" value={form.accessories} onChange={(event) => update('accessories', event.target.value)} rows={3} required /></div>
                <div className="mt-4"><Textarea label="Stan sprzętu przy wydaniu" value={form.conditionNotes} onChange={(event) => update('conditionNotes', event.target.value)} rows={3} required /></div>

                <div className="mt-5 rounded-[--radius-sm] border border-border bg-bg-primary/40 p-4">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div>
                      <p className="text-sm font-semibold text-text-primary">Protokół wydania (Załącznik nr 1)</p>
                      <p className="text-xs text-text-muted mt-0.5 max-w-md">
                        Klient podpisze dokładnie tę listę. Usuń pozycje, których nie wydajesz — np. brakujący
                        wąż albo akcesorium, którego klient nie chce.
                      </p>
                    </div>
                    {handoverEdited && form.productIds.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setHandoverNonce((nonce) => nonce + 1)}
                        className="inline-flex items-center gap-1.5 text-xs text-text-muted hover:text-gold transition-colors"
                      >
                        <RotateCcw className="w-3.5 h-3.5" /> Przywróć domyślne
                      </button>
                    )}
                  </div>

                  {handoverItems.length === 0 ? (
                    <p className="mt-3 text-xs text-text-muted">
                      Wybierz urządzenie, aby system zaproponował listę wydawanego wyposażenia.
                    </p>
                  ) : (
                    <ul className="mt-3 space-y-2">
                      {handoverItems.map((item, index) => (
                        <li key={index} className="flex items-center gap-2">
                          <span className="w-6 shrink-0 text-xs text-text-muted tabular-nums">{handoverMarkers[index]}</span>
                          <input
                            id={`protokol-wydania-${index + 1}`}
                            aria-label={`Pozycja ${index + 1} protokołu wydania`}
                            value={item}
                            onChange={(event) => updateHandoverItem(index, event.target.value)}
                            className={`w-full bg-bg-card border border-border rounded-[--radius-sm] px-3 py-2 text-sm text-text-primary placeholder:text-text-muted transition-all hover:border-border-hover focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold/30 ${handoverMarkers[index] ? '' : 'font-semibold text-gold'}`}
                          />
                          <button
                            type="button"
                            onClick={() => removeHandoverItem(index)}
                            aria-label={`Usuń pozycję ${index + 1} protokołu wydania`}
                            className="shrink-0 p-2 rounded-[--radius-sm] text-text-muted hover:text-error hover:bg-error/10 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}

                  <button
                    type="button"
                    onClick={addHandoverItem}
                    className="mt-3 inline-flex items-center gap-1.5 text-sm text-gold hover:text-gold-light transition-colors"
                  >
                    <Plus className="w-4 h-4" /> Dodaj pozycję
                  </button>
                </div>

                <div className="mt-4"><Textarea label="Uwagi do rezerwacji (opcjonalnie)" value={form.notes} onChange={(event) => update('notes', event.target.value)} rows={2} /></div>
              </FormCard>
            </div>

            <aside className="xl:sticky xl:top-6">
              <Card variant="glass" padding="none" className="overflow-hidden border-gold/20">
                {selectedProduct && selectedProducts.length > 0 ? (
                  <>
                    <div className="relative bg-white aspect-[4/3] border-b border-border">
                      <img src={selectedProduct.image} alt={selectedProduct.name} className="absolute inset-0 w-full h-full object-contain p-6" />
                      <div className="absolute top-3 left-3 px-2.5 py-1 rounded-md bg-black/75 text-white text-[11px] font-medium backdrop-blur-sm">
                        {selectedProducts.length === 1 ? '1 URZĄDZENIE' : `${selectedProducts.length} URZĄDZENIA`}
                      </div>
                    </div>
                    <div className="p-5">
                      <p className="text-xs uppercase tracking-wider text-gold mb-1">{categoryLabel(selectedProduct.categoryId)}</p>
                      <h2 className="text-xl font-bold leading-snug">Wybrany zestaw</h2>
                      <div className="mt-4 space-y-2">
                        {price?.lineItems.map(({ product, price: itemPrice }, index) => (
                          <div key={product.id} className="flex items-start justify-between gap-3 p-3 rounded-[--radius-sm] bg-surface-soft border border-border">
                            <div className="min-w-0">
                              <p className="text-[10px] uppercase tracking-wider text-text-muted">Pozycja {index + 1}</p>
                              <p className="text-sm font-medium mt-0.5 leading-snug">{shortProductName(product.name)}</p>
                            </div>
                            <span className="text-sm font-semibold text-gold whitespace-nowrap">{itemPrice} zł</span>
                          </div>
                        ))}
                      </div>

                      {price && (
                        <div className="mt-5 pt-5 border-t border-border space-y-2.5 text-sm">
                          <SummaryRow
                            label={form.isIndefinite ? 'Opłata startowa • 1 doba' : `Najem • ${price.days} ${price.days === 1 ? 'doba' : 'doby'}`}
                            value={`${price.base} zł`}
                          />
                          {price.deliveryFee > 0 && <SummaryRow label="Dostawa i odbiór" value={`${price.deliveryFee} zł`} />}
                          {price.weekendFee > 0 && <SummaryRow label="Odbiór weekendowy" value={`${price.weekendFee} zł`} />}
                          {finalPricing && finalPricing.discount > 0 && (
                            <SummaryRow label="Rabat pracownika" value={`-${finalPricing.discount} zł`} />
                          )}

                          <div className="pt-4 mt-3 border-t border-border space-y-3">
                            <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                              <Percent className="w-3.5 h-3.5" /> Rabat i cena
                            </p>
                            <Input
                              label="Kod rabatowy klienta"
                              value={form.couponCode}
                              onChange={(event) => update('couponCode', event.target.value.toUpperCase())}
                              placeholder="WBR-XXXX-XXXX"
                              autoComplete="off"
                            />
                            <div className="grid grid-cols-2 gap-3">
                              <Input
                                label="Rabat (zł)"
                                type="number"
                                min={0}
                                value={form.manualDiscount}
                                onChange={(event) => update('manualDiscount', event.target.value)}
                                placeholder="0"
                              />
                              <Input
                                label="Cena końcowa (zł)"
                                type="number"
                                min={0}
                                value={form.priceOverride}
                                onChange={(event) => update('priceOverride', event.target.value)}
                                placeholder={String(finalPricing?.afterDiscount ?? price.total)}
                              />
                            </div>
                            {finalPricing?.override !== null && finalPricing !== null && (
                              <Input
                                label="Powód zmiany ceny"
                                value={form.priceNote}
                                onChange={(event) => update('priceNote', event.target.value)}
                                placeholder="np. stały klient, ustalenie telefoniczne"
                              />
                            )}
                            <p className="text-[11px] text-text-muted leading-relaxed">
                              Puste pole „Cena końcowa” oznacza cenę wyliczoną przez system.
                            </p>
                          </div>

                          <div className="flex justify-between items-end pt-3 mt-3 border-t border-border">
                            <span className="font-medium">
                              Do zapłaty
                              {finalPricing?.isEdited && (
                                <span className="block text-[11px] font-normal text-gold">cena ustalona ręcznie</span>
                              )}
                            </span>
                            <span className="text-right">
                              {finalPricing?.isEdited && (
                                <span className="block text-xs text-text-muted line-through">{price.total} zł</span>
                              )}
                              <span className="text-3xl font-bold text-gold">
                                {finalPricing?.total ?? price.total} zł
                              </span>
                            </span>
                          </div>
                          <SummaryRow label="Kaucja zwrotna" value={`${form.deposit} zł`} muted />
                          {form.isIndefinite && (
                            <p className="text-[11px] text-text-muted leading-relaxed pt-2">
                              Kwota końcowa zostanie przeliczona po ustaleniu faktycznej daty zwrotu.
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="p-7 text-center">
                    <div className="w-16 h-16 rounded-[--radius-sm] bg-gold/10 border border-gold/20 flex items-center justify-center mx-auto">
                      <Package className="w-8 h-8 text-gold" />
                    </div>
                    <h2 className="font-bold text-lg mt-4">Najpierw wybierz sprzęt</h2>
                    <p className="text-sm text-text-muted mt-2">Kliknij zdjęcie urządzenia w katalogu powyżej.</p>
                  </div>
                )}

                <div className="px-5 pb-5">
                  {error && (
                    <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/25 text-sm text-red-300 light:text-red-700">{error}</div>
                  )}
                  <Button type="submit" variant="primary" size="lg" className="w-full" disabled={selectedProducts.length === 0 || submitting}>
                    {submitting ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <FileSignature className="w-5 h-5 mr-2" />}
                    {submitting ? 'Tworzenie…' : 'Przejdź do umowy'}
                  </Button>
                  <p className="text-[11px] text-text-muted mt-3 text-center leading-relaxed">
                    Płatność i wydanie sprzętu zostaną odblokowane po podpisaniu umowy przez obie strony.
                  </p>
                </div>
              </Card>
            </aside>
          </div>
        </form>
      </main>
    </div>
  );
}

function FormCard({
  number,
  icon,
  title,
  description,
  children,
}: {
  number: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <Card variant="glass" className="p-5 sm:p-7 border-border">
      <div className="flex items-start gap-4 mb-6">
        <div className="w-11 h-11 rounded-[--radius-sm] bg-gold/10 border border-gold/25 flex items-center justify-center text-gold shrink-0">{icon}</div>
        <div className="min-w-0">
          <p className="text-[11px] text-gold uppercase tracking-[0.16em] font-semibold">Krok {number}</p>
          <h2 className="font-bold text-xl mt-0.5">{title}</h2>
          <p className="text-sm text-text-muted mt-1">{description}</p>
        </div>
      </div>
      {children}
    </Card>
  );
}

function ProductCatalog({ selectedIds, onToggle }: { selectedIds: string[]; onToggle: (id: string) => void }) {
  const [filter, setFilter] = useState('all');
  const filters = [
    { id: 'all', label: 'Wszystkie' },
    { id: 'odkurzacze-piorace', label: 'Piorące' },
    { id: 'odkurzacze-przemyslowe', label: 'Przemysłowe' },
    { id: 'ozonatory', label: 'Ozonatory' },
    { id: 'pozostale', label: 'Pozostałe' },
  ];
  const visibleProducts = filter === 'all' ? products : products.filter((product) => product.categoryId === filter);
  const katalogAktualny = isCatalogLoaded();

  // 0 sztuk w magazynie = sprzętu nie ma fizycznie, nie da się go wynająć na żaden termin.
  // 0 dostępnych dziś przy niezerowym stanie = jest wypożyczony, ale przyszły termin bywa wolny.
  const stanSprzetu = (product: typeof products[number]) => {
    if (!katalogAktualny) return { blokada: false, etykieta: '' };
    if (product.totalQuantity === 0) return { blokada: true, etykieta: 'Brak w magazynie' };
    if (product.availableToday === 0) return { blokada: false, etykieta: 'Wypożyczony dziś' };
    return { blokada: false, etykieta: '' };
  };

  return (
    <section className="rounded-[--radius-sm] border border-border bg-bg-card overflow-hidden">
      <div className="px-5 sm:px-7 py-5 border-b border-border flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-gold/10 border border-gold/25 flex items-center justify-center text-gold shrink-0">
            <Layers3 className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-[0.16em] text-gold font-semibold">Wybór urządzeń</p>
            <h2 className="text-xl font-bold mt-0.5">Co klient wypożycza?</h2>
            <p className="text-sm text-text-muted mt-1">Klikaj urządzenia, aby zbudować zestaw na jednej umowie.</p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <span className="text-xs text-text-secondary"><strong className="text-gold">{selectedIds.length}</strong> wybranych</span>
          <div className="flex gap-2 overflow-x-auto pb-1 max-w-full" role="tablist" aria-label="Kategorie sprzętu">
          {filters.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={filter === item.id}
              onClick={() => setFilter(item.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap border transition-colors ${
                filter === item.id ? 'bg-gold text-gold-contrast border-gold' : 'bg-transparent text-text-secondary border-border hover:border-gold/40 hover:text-text-primary'
              }`}
            >
              {item.label}
            </button>
          ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-px bg-surface-strong">
        {visibleProducts.map((product) => {
          const selected = selectedIds.includes(product.id);
          const { blokada, etykieta } = stanSprzetu(product);
          return (
            <button
              key={product.id}
              type="button"
              aria-pressed={selected}
              disabled={blokada}
              aria-label={`${blokada ? 'Niedostępny' : selected ? 'Usuń' : 'Dodaj'} ${product.name}`}
              onClick={() => onToggle(product.id)}
              className={`group relative text-left bg-bg-card p-3 sm:p-4 transition-colors focus-visible:outline-2 focus-visible:outline-gold focus-visible:outline-offset-[-2px] ${
                blokada ? 'opacity-45 cursor-not-allowed' : selected ? 'bg-gold/[0.08]' : 'hover:bg-surface-soft'
              }`}
            >
              <div className={`relative aspect-[4/3] rounded-lg bg-white overflow-hidden border transition-colors ${selected ? 'border-gold' : 'border-transparent group-hover:border-gold/30'}`}>
                <img src={product.image} alt="" className="absolute inset-0 w-full h-full object-contain p-2 sm:p-3" loading="lazy" />
                {selected && (
                  <span className="absolute top-2 right-2 w-7 h-7 rounded-full bg-gold text-gold-contrast flex items-center justify-center shadow-lg">
                    <Check className="w-4 h-4" strokeWidth={3} />
                  </span>
                )}
                {etykieta && (
                  <span className={`absolute bottom-2 left-2 px-2 py-0.5 rounded text-[10px] font-semibold ${
                    blokada ? 'bg-error text-white' : 'bg-amber-500 text-black'
                  }`}>
                    {etykieta}
                  </span>
                )}
              </div>
              <div className="pt-3">
                <p className="text-[10px] uppercase tracking-wider text-gold">{categoryLabel(product.categoryId)}</p>
                <h3 className="text-xs sm:text-sm font-semibold leading-snug mt-1 line-clamp-2 min-h-[2.5rem]">{shortProductName(product.name)}</h3>
                <div className="flex items-baseline justify-between gap-2 mt-2">
                  <span className="text-[11px] text-text-muted">od</span>
                  <span className="font-bold text-gold">{product.pricePerDay} zł<span className="text-[10px] font-normal text-text-muted">/doba</span></span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function PickupOption({ selected, icon, title, description, onClick }: { selected: boolean; icon: React.ReactNode; title: string; description: string; onClick: () => void }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onClick}
      className={`relative text-left p-4 rounded-lg border transition-colors ${selected ? 'border-gold bg-gold/10' : 'border-border bg-bg-primary/40 hover:border-border-hover'}`}
    >
      <span className={`w-9 h-9 rounded-lg flex items-center justify-center ${selected ? 'bg-gold text-gold-contrast' : 'bg-surface-soft text-text-muted'}`}>{icon}</span>
      <span className="block text-sm font-semibold mt-3">{title}</span>
      <span className="block text-xs text-text-muted mt-1 leading-relaxed">{description}</span>
      {selected && <Check className="absolute top-3 right-3 w-4 h-4 text-gold" />}
    </button>
  );
}

function ProcessStep({ number, label, active = false }: { number: string; label: string; active?: boolean }) {
  return (
    <div className={`flex items-center gap-1.5 ${active ? 'text-gold' : 'text-text-muted'}`}>
      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold border ${active ? 'bg-gold text-gold-contrast border-gold' : 'border-border'}`}>{number}</span>
      <span className="hidden sm:inline">{label}</span>
    </div>
  );
}

function SummaryRow({ label, value, muted = false }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className={`flex justify-between gap-4 ${muted ? 'text-text-muted' : 'text-text-secondary'}`}>
      <span>{label}</span><span className="font-medium text-text-primary">{value}</span>
    </div>
  );
}

function categoryLabel(categoryId: string) {
  return {
    'odkurzacze-piorace': 'Odkurzacz piorący',
    'odkurzacze-przemyslowe': 'Sprzęt przemysłowy',
    ozonatory: 'Ozonowanie i powietrze',
    pozostale: 'Pozostały sprzęt',
  }[categoryId] || 'Sprzęt';
}

function shortProductName(name: string) {
  return name.replace(/^Odkurzacz Piorący /, '').replace(/^Odkurzacz Przemysłowy /, '');
}

export default StaffRentalPage;
