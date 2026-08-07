import { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Calendar,
  MapPin, 
  Truck, 
  User, 
  Mail, 
  Phone, 
  Building2,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Send,
  Home,
  FileText,
  ChevronDown,
  Info,
} from 'lucide-react';
import { Card, Input, Select, Button, Textarea, DatePicker } from '@/components/ui';
import { 
  categories, 
  getProductsByCategory, 
  calculateRentalCost, 
  getProductById,
  type Product 
} from '@/data/products';
import { formatPrice, calculateDays } from '@/lib/utils';

// Helper to get today's date in local timezone as YYYY-MM-DD
const getTodayLocalDate = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
import { staggerContainerVariants, staggerItemVariants, revealVariants } from '@/lib/motion';
import { useSubmitForm } from '@/hooks';
import { submitReservation, checkAvailability, getProductBlockedDates, validateCoupon, checkDeliveryArea, type ReservationPayload } from '@/services/api';
import { useReservationContext } from '@/context/ReservationContext';

interface FormData {
  // Product selection
  categoryId: string;
  productId: string;
  // Dates
  startDate: string;
  endDate: string;
  // Times (pickup/return hours)
  startTime: string;
  endTime: string;
  // Delivery
  delivery: boolean;
  deliveryOut: boolean;
  deliveryBack: boolean;
  city: string;
  postalCode: string;
  address: string;
  weekendPickup: boolean;
  // Contact
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  company: string;
  // Invoice
  wantsInvoice: boolean;
  invoiceNip: string;
  invoiceCompany: string;
  invoiceAddress: string;
  // Additional
  notes: string;
  couponCode: string;
  acceptTerms: boolean;
  acceptRodo: boolean;
}

const initialFormData: FormData = {
  categoryId: '',
  productId: '',
  startDate: '',
  endDate: '',
  startTime: '09:00',
  endTime: '09:00',
  delivery: false,
  deliveryOut: false,
  deliveryBack: false,
  city: '',
  postalCode: '',
  address: '',
  weekendPickup: false,
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  company: '',
  wantsInvoice: false,
  invoiceNip: '',
  invoiceCompany: '',
  invoiceAddress: '',
  notes: '',
  couponCode: '',
  acceptTerms: false,
  acceptRodo: false,
};

// Adres biura dla odbioru osobistego
const OFFICE_ADDRESS = 'ul. Juliusza Słowackiego 24/11, 35-060 Rzeszów';

// Dostępne godziny odbioru/zwrotu (od 8:00 do 20:00)
const AVAILABLE_HOURS = [
  '08:00', '09:00', '10:00', '11:00', '12:00', '13:00', 
  '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00'
];

/** Zapis kodu jako „35-001” niezależnie od tego, jak klient go wpisał. */
const formatujKod = (wartosc: string): string => {
  const cyfry = wartosc.replace(/\D/g, '').slice(0, 5);
  return cyfry.length <= 2 ? cyfry : `${cyfry.slice(0, 2)}-${cyfry.slice(2)}`;
};

export function Reservation() {
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [availabilityStatus, setAvailabilityStatus] = useState<'idle' | 'checking' | 'available' | 'unavailable'>('idle');
  const [availabilityMessage, setAvailabilityMessage] = useState<string | null>(null);
  // Zajęte terminy wybranego produktu (blokada w kalendarzu)
  const [blockedRanges, setBlockedRanges] = useState<Array<{ startDate: string; endDate: string }>>([]);
  
  // Obszar dowozu rozstrzyga kod pocztowy — bez pytania cudzego serwisu o mapę.
  const [deliveryDistanceStatus, setDeliveryDistanceStatus] = useState<'idle' | 'checking' | 'ok' | 'too_far'>('idle');
  const [deliveryDistanceMessage, setDeliveryDistanceMessage] = useState<string | null>(null);

  // Kupon rabatowy - podgląd; ostateczny rabat i tak liczy serwer przy wysyłce
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; discountAmount: number } | null>(null);
  const [couponStatus, setCouponStatus] = useState<'idle' | 'checking' | 'invalid'>('idle');
  const [couponMessage, setCouponMessage] = useState<string | null>(null);

  // Get pre-fill data from CostWidget
  const { preFillData, clearPreFillData } = useReservationContext();

  // Apply pre-fill data when it changes
  useEffect(() => {
    if (preFillData) {
      setFormData(prev => ({
        ...prev,
        categoryId: preFillData.categoryId,
        productId: preFillData.productId,
        startDate: preFillData.startDate,
        endDate: preFillData.endDate,
        city: preFillData.city,
        delivery: preFillData.delivery,
      }));
      // Clear pre-fill data after applying
      clearPreFillData();
    }
  }, [preFillData, clearPreFillData]);

  // API submission hook
  const {
    status,
    error: apiError,
    submit: submitToApi,
  } = useSubmitForm(submitReservation, {
    resetOnSuccess: true,
    successTimeout: 5000,
    onSuccess: (data) => {
      setFormData(initialFormData);
      setValidationError(null);

      // Online payment active -> go straight to the gateway
      if (data?.payment?.redirectUrl) {
        window.location.assign(data.payment.redirectUrl);
        return;
      }

      // Scroll to the success message (top of reservation section)
      const reservationSection = document.getElementById('rezerwacja');
      if (reservationSection) {
        reservationSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    },
  });

  // Combined error message
  const errorMessage = validationError || apiError;

  // Get products for selected category
  const availableProducts = useMemo(() => {
    if (!formData.categoryId) return [];
    return getProductsByCategory(formData.categoryId).filter((p) => p.available);
  }, [formData.categoryId]);

  // Get selected product
  const selectedProduct = useMemo(() => {
    if (!formData.productId) return null;
    return getProductById(formData.productId);
  }, [formData.productId]);

  // Calculate rental days with time consideration
  // Logic: doba (24h period) starts from pickup time
  // If return time > pickup time on same day difference, it's an extra day
  const rentalDays = useMemo(() => {
    if (!formData.startDate || !formData.endDate) return 0;
    const start = new Date(formData.startDate);
    const end = new Date(formData.endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) return 0;
    
    // Base days calculation
    let baseDays = calculateDays(start, end);
    
    // Parse times (format: "HH:MM")
    const startTimeParts = formData.startTime.split(':').map(Number);
    const endTimeParts = formData.endTime.split(':').map(Number);
    const startMinutes = startTimeParts[0] * 60 + startTimeParts[1];
    const endMinutes = endTimeParts[0] * 60 + endTimeParts[1];
    
    // If return time is after pickup time, add 1 extra day
    // E.g., pickup at 09:00, return at 10:00 = +1 day
    if (endMinutes > startMinutes) {
      baseDays += 1;
    }
    
    return baseDays;
  }, [formData.startDate, formData.endDate, formData.startTime, formData.endTime]);

  // Check if weekend rental
  const isWeekendRental = useMemo(() => {
    if (!formData.startDate) return false;
    const start = new Date(formData.startDate);
    return start.getDay() === 5 && rentalDays === 3;
  }, [formData.startDate, rentalDays]);

  // §12 umowy: opłata weekendowa należy się „każdorazowo", więc także za zwrot.
  const zdarzeniaWeekendowe = useMemo(() => {
    const weekendowy = (data: string) => {
      if (!data) return false;
      const dzien = new Date(`${data}T12:00:00`).getDay();
      return dzien === 0 || dzien === 6;
    };
    return (weekendowy(formData.startDate) ? 1 : 0) + (weekendowy(formData.endDate) ? 1 : 0);
  }, [formData.startDate, formData.endDate]);

  const isWeekendPickup = zdarzeniaWeekendowe > 0;

  // Calculate cost
  const costSummary = useMemo(() => {
    if (!formData.productId || rentalDays === 0) return null;
    return calculateRentalCost(
      formData.productId,
      rentalDays,
      { dowoz: formData.deliveryOut, odbior: formData.deliveryBack },
      isWeekendRental,
      zdarzeniaWeekendowe
    );
  }, [formData.productId, rentalDays, formData.deliveryOut, formData.deliveryBack, isWeekendRental, zdarzeniaWeekendowe]);

  // Fetch blocked (reserved) date ranges when product changes
  useEffect(() => {
    if (!formData.productId) {
      setBlockedRanges([]);
      return;
    }

    const controller = new AbortController();
    getProductBlockedDates(formData.productId, controller.signal).then((result) => {
      if (controller.signal.aborted) return;
      if (result.success && result.data?.blockedDates) {
        setBlockedRanges(
          result.data.blockedDates
            .map((b) => ({ startDate: b.startDate, endDate: b.endDate }))
        );
      } else {
        setBlockedRanges([]);
      }
    });

    return () => controller.abort();
  }, [formData.productId]);

  // Auto-check availability when product/dates change
  useEffect(() => {
    // Reset if missing required fields
    if (!formData.productId || !formData.startDate || !formData.endDate || rentalDays === 0) {
      setAvailabilityStatus('idle');
      setAvailabilityMessage(null);
      return;
    }

    // Debounce the check; abort stale in-flight requests (race-condition safe)
    const controller = new AbortController();
    const timeoutId = setTimeout(async () => {
      setAvailabilityStatus('checking');
      
      try {
        const result = await checkAvailability(
          formData.productId,
          formData.startDate,
          formData.endDate,
          controller.signal
        );

        if (controller.signal.aborted) return;

        if (!result.success) {
          setAvailabilityStatus('idle');
          return;
        }

        if (result.data && !result.data.available) {
          setAvailabilityStatus('unavailable');
          const conflicts = result.data.conflicts || [];
          if (conflicts.length > 0) {
            const conflictDates = conflicts.map(c => `${c.startDate} - ${c.endDate}`).join(', ');
            setAvailabilityMessage(`Urządzenie jest już zarezerwowane w terminie: ${conflictDates}. Wybierz inny termin.`);
          } else {
            setAvailabilityMessage('Urządzenie jest niedostępne w wybranym terminie.');
          }
        } else {
          setAvailabilityStatus('available');
          setAvailabilityMessage(null);
        }
      } catch {
        if (!controller.signal.aborted) setAvailabilityStatus('idle');
      }
    }, 500); // 500ms debounce

    return () => {
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [formData.productId, formData.startDate, formData.endDate, rentalDays]);

  // Update form field
  const updateField = <K extends keyof FormData>(field: K, value: FormData[K]) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    
    // Reset product when category changes
    if (field === 'categoryId') {
      setFormData((prev) => ({ ...prev, productId: '' }));
    }
    
    // Reset availability status when product or dates change
    if (field === 'productId' || field === 'startDate' || field === 'endDate') {
      setAvailabilityStatus('idle');
      setAvailabilityMessage(null);
      // A different cart changes the rent, so a previously priced coupon no
      // longer reflects the real discount - force a re-check.
      setAppliedCoupon(null);
      setCouponStatus('idle');
      setCouponMessage(null);
    }

    // Reset delivery distance when delivery is toggled off or address changes
    if (field === 'delivery' && value === false) {
      setDeliveryDistanceStatus('idle');
      setDeliveryDistanceMessage(null);
    }
  };

  const applyCoupon = async () => {
    const code = formData.couponCode.trim().toUpperCase();
    if (!code) return;
    if (!costSummary) {
      setCouponStatus('invalid');
      setCouponMessage('Najpierw wybierz sprzęt i termin najmu');
      return;
    }

    setCouponStatus('checking');
    setCouponMessage(null);
    const response = await validateCoupon(code, costSummary.basePrice);

    if (!response.valid) {
      setAppliedCoupon(null);
      setCouponStatus('invalid');
      setCouponMessage(response.message || 'Kupon jest nieprawidłowy');
      return;
    }

    setAppliedCoupon({ code, discountAmount: Number(response.discountAmount || 0) });
    setCouponStatus('idle');
    setCouponMessage(response.message || 'Kupon został naliczony');
  };

  const removeCoupon = () => {
    setAppliedCoupon(null);
    setCouponStatus('idle');
    setCouponMessage(null);
    setFormData((prev) => ({ ...prev, couponCode: '' }));
  };

  /**
   * Obszar dowozu rozstrzyga kod pocztowy. Wcześniej liczyła go zewnętrzna mapa
   * (Nominatim) z promienia 30 km — rezerwacja zależała od cudzego serwisu,
   * a wypożyczalnia obsługuje wyłącznie Rzeszów.
   */
  useEffect(() => {
    const dowolnyKurs = formData.deliveryOut || formData.deliveryBack;
    if (!dowolnyKurs) {
      setDeliveryDistanceStatus('idle');
      setDeliveryDistanceMessage(null);
      return;
    }
    if (formData.postalCode.length < 6) {
      setDeliveryDistanceStatus('idle');
      setDeliveryDistanceMessage(formData.postalCode ? 'Uzupełnij kod pocztowy (00-000)' : null);
      return;
    }

    setDeliveryDistanceStatus('checking');
    let aktualne = true;
    checkDeliveryArea(formData.postalCode).then((wynik) => {
      if (!aktualne) return;
      if (wynik.wObszarze) {
        setDeliveryDistanceStatus('ok');
        setDeliveryDistanceMessage('Dowozimy pod ten adres');
      } else {
        setDeliveryDistanceStatus('too_far');
        setDeliveryDistanceMessage(wynik.powod || 'Poza obszarem dowozu');
      }
    });
    return () => { aktualne = false; };
  }, [formData.deliveryOut, formData.deliveryBack, formData.postalCode]);

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);
    
    // Basic validation
    if (!formData.productId || !formData.startDate || !formData.endDate) {
      setValidationError('Wybierz produkt i daty wynajmu');
      return;
    }

    if (!formData.firstName || !formData.email || !formData.phone) {
      setValidationError('Wypełnij wymagane dane kontaktowe');
      return;
    }

    if (!formData.acceptTerms || !formData.acceptRodo) {
      setValidationError('Zaakceptuj regulamin i zgodę RODO');
      return;
    }

    if (!selectedProduct || !costSummary) {
      setValidationError('Wybierz produkt i uzupełnij daty');
      return;
    }

    // Block if unavailable (already checked automatically)
    if (availabilityStatus === 'unavailable') {
      setValidationError('Wybrany termin jest niedostępny. Zmień daty.');
      return;
    }

    // Block if still checking
    if (availabilityStatus === 'checking') {
      setValidationError('Poczekaj na sprawdzenie dostępności...');
      return;
    }

    const zamowionyDojazd = formData.deliveryOut || formData.deliveryBack;

    if (zamowionyDojazd && deliveryDistanceStatus === 'too_far') {
      setValidationError(deliveryDistanceMessage || 'Adres jest poza obszarem dowozu. Odznacz dojazd albo zmień adres.');
      return;
    }

    if (zamowionyDojazd && deliveryDistanceStatus === 'checking') {
      setValidationError('Poczekaj na sprawdzenie obszaru dowozu…');
      return;
    }

    if (zamowionyDojazd && (!formData.postalCode || !formData.address)) {
      setValidationError('Podaj kod pocztowy i adres, pod który mamy dojechać.');
      return;
    }

    // Prepare payload for API
    const payload: ReservationPayload = {
      productId: formData.productId,
      productName: selectedProduct.name,
      categoryId: formData.categoryId,
      startDate: formData.startDate,
      endDate: formData.endDate,
      startTime: formData.startTime,
      endTime: formData.endTime,
      days: rentalDays,
      delivery: zamowionyDojazd,
      deliveryOut: formData.deliveryOut,
      deliveryBack: formData.deliveryBack,
      city: zamowionyDojazd ? 'Rzeszów' : undefined,
      postalCode: zamowionyDojazd ? formData.postalCode : undefined,
      address: zamowionyDojazd ? formData.address : undefined,
      weekendPickup: isWeekendPickup,
      firstName: formData.firstName,
      lastName: formData.lastName,
      email: formData.email,
      phone: formData.phone,
      company: formData.company || undefined,
      wantsInvoice: formData.wantsInvoice,
      invoiceNip: formData.wantsInvoice ? formData.invoiceNip : undefined,
      invoiceCompany: formData.wantsInvoice ? formData.invoiceCompany : undefined,
      invoiceAddress: formData.wantsInvoice ? formData.invoiceAddress : undefined,
      notes: formData.notes || undefined,
      couponCode: appliedCoupon?.code,
      totalPrice: Math.max(costSummary.total - (appliedCoupon?.discountAmount || 0), 0),
    };

    // Submit to API
    await submitToApi(payload);
  };

  return (
    <section id="rezerwacja" className="relative overflow-hidden py-20 md:py-28 lg:py-32">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-bg-secondary via-bg-primary to-bg-primary pointer-events-none" />
      
      {/* Gold glow */}
      <div 
        className="absolute top-1/4 right-0 w-96 h-96 rounded-full opacity-10 blur-3xl pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(184, 151, 42, 0.3) 0%, transparent 70%)' }}
      />

      <div className="relative max-w-7xl mx-auto px-4 md:px-6 lg:px-8">
        {/* Section Header */}
        <motion.div
          variants={revealVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-100px' }}
          className="text-center mb-12 md:mb-16"
        >
          <span className="section-kicker">
            Formularz rezerwacji
          </span>
          {/* Jedyna sekcja na podstronie /rezerwacja - jej tytuł jest H1 strony. */}
          <h1 className="section-title">
            Zarezerwuj sprzęt
          </h1>
          <p className="section-copy max-w-2xl mx-auto">
            Wypełnij formularz, aby zarezerwować wybrany sprzęt. 
            Potwierdzenie otrzymasz na podany adres e-mail.
          </p>
        </motion.div>

        {/* Success State */}
        {status === 'success' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="max-w-2xl mx-auto"
          >
            <Card variant="glow" className="p-8 text-center">
              <CheckCircle2 className="w-16 h-16 text-success mx-auto mb-4" />
              <h3 className="text-2xl font-bold text-text-primary mb-2">
                Rezerwacja wysłana!
              </h3>
              <p className="text-text-secondary">
                Dziękujemy za rezerwację. Potwierdzenie zostało wysłane na podany adres e-mail.
                Skontaktujemy się z Tobą w ciągu 24 godzin.
              </p>
            </Card>
          </motion.div>
        )}

        {/* Form */}
        {status !== 'success' && (
          <motion.form
            variants={staggerContainerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-50px' }}
            onSubmit={handleSubmit}
            className="grid grid-cols-1 lg:grid-cols-3 gap-8"
          >
            {/* Left Column - Form Fields */}
            <div className="lg:col-span-2 space-y-6">
              {/* Product Selection */}
              <motion.div variants={staggerItemVariants}>
                <Card variant="glass" padding="lg">
                  <h3 className="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-gold text-bg-primary text-sm font-bold flex items-center justify-center">1</span>
                    Wybierz sprzęt
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Select
                      label="Kategoria"
                      placeholder="Wybierz kategorię"
                      value={formData.categoryId}
                      onChange={(e) => updateField('categoryId', e.target.value)}
                      options={categories.map((c) => ({ value: c.id, label: c.name }))}
                      required
                    />
                    <Select
                      label="Urządzenie"
                      placeholder="Wybierz urządzenie"
                      value={formData.productId}
                      onChange={(e) => updateField('productId', e.target.value)}
                      options={availableProducts.map((p: Product) => ({ value: p.id, label: p.name }))}
                      disabled={!formData.categoryId}
                      required
                    />
                  </div>
                  
                  {/* Product info */}
                  {selectedProduct && (
                    <div className="mt-4 p-4 rounded-lg bg-bg-primary/50 border border-border">
                      <p className="text-sm text-text-secondary mb-2">{selectedProduct.description}</p>
                      <div className="flex flex-wrap gap-2">
                        {selectedProduct.features.map((f) => (
                          <span key={f} className="text-xs px-2 py-1 rounded bg-gold/10 text-gold-light light:text-gold-dark">
                            {f}
                          </span>
                        ))}
                      </div>
                      {selectedProduct.includedAccessories.length > 0 && (
                        <p className="text-xs text-text-muted mt-2">
                          W cenie: {selectedProduct.includedAccessories.join(', ')}
                        </p>
                      )}
                    </div>
                  )}
                </Card>
              </motion.div>

              {/* Dates */}
              <motion.div variants={staggerItemVariants}>
                <Card variant="glass" padding="lg" className="overflow-visible">
                  <h3 className="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-gold text-bg-primary text-sm font-bold flex items-center justify-center">2</span>
                    Termin wynajmu
                  </h3>
                  
                  {/* Data i godzina odbioru */}
                  <div className="mb-4">
                    <p className="text-sm font-medium text-text-secondary mb-2">Odbiór</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 overflow-visible">
                      <DatePicker
                        label="Data odbioru"
                        value={formData.startDate}
                        onChange={(value) => updateField('startDate', value)}
                        minDate={getTodayLocalDate()}
                        blockedRanges={blockedRanges}
                        required
                      />
                      <Select
                        label="Godzina odbioru"
                        value={formData.startTime}
                        onChange={(e) => updateField('startTime', e.target.value)}
                        options={AVAILABLE_HOURS.map((h) => ({ value: h, label: h }))}
                        required
                      />
                    </div>
                  </div>
                  
                  {/* Data i godzina zwrotu */}
                  <div className="mb-4">
                    <p className="text-sm font-medium text-text-secondary mb-2">Zwrot</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 overflow-visible">
                      <DatePicker
                        label="Data zwrotu"
                        value={formData.endDate}
                        onChange={(value) => updateField('endDate', value)}
                        minDate={formData.startDate || getTodayLocalDate()}
                        blockedRanges={blockedRanges}
                        required
                      />
                      <Select
                        label="Godzina zwrotu"
                        value={formData.endTime}
                        onChange={(e) => updateField('endTime', e.target.value)}
                        options={AVAILABLE_HOURS.map((h) => ({ value: h, label: h }))}
                        required
                      />
                    </div>
                  </div>
                  
                  {/* Info o obliczaniu doby */}
                  <div className="p-3 rounded-[--radius-sm] bg-gold/10 border border-gold/20 mb-3 flex items-start gap-2.5">
                    <Info className="w-4 h-4 text-gold-light light:text-gold-dark shrink-0 mt-0.5" aria-hidden="true" />
                    <p className="text-xs text-gold-light light:text-gold-dark leading-relaxed">
                      Doba trwa 24h od godziny odbioru. Przykład: odbiór 21.01 o 09:00 = zwrot do 22.01 do 09:00 (1 doba). Zwrot po tej godzinie = dodatkowa doba.
                    </p>
                  </div>
                  
                  {rentalDays > 0 && (
                    <p className="text-sm text-text-muted mt-2">
                      Czas wynajmu: <span className="text-gold font-medium">{rentalDays} {rentalDays === 1 ? 'doba' : rentalDays < 5 ? 'doby' : 'dób'}</span>
                      {isWeekendRental && <span className="ml-2 text-success">(cena weekendowa)</span>}
                    </p>
                  )}
                  
                  {/* Availability status indicator */}
                  {availabilityStatus === 'checking' && (
                    <div className="mt-3 p-3 rounded-lg bg-gold/10 border border-gold/20 flex items-center gap-2">
                      <Loader2 className="w-4 h-4 text-gold-light light:text-gold-dark animate-spin" />
                      <p className="text-sm text-gold-light light:text-gold-dark">Sprawdzanie dostępności...</p>
                    </div>
                  )}
                  
                  {availabilityStatus === 'available' && formData.productId && rentalDays > 0 && (
                    <div className="mt-3 p-3 rounded-lg bg-success/10 border border-success/20 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-success" />
                      <p className="text-sm text-success">Termin dostępny!</p>
                    </div>
                  )}
                  
                  {availabilityStatus === 'unavailable' && availabilityMessage && (
                    <div className="mt-3 p-3 rounded-lg bg-error/10 border border-error/20 flex items-start gap-2">
                      <AlertCircle className="w-5 h-5 text-error shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-semibold text-error">Termin niedostępny</p>
                        <p className="text-xs text-error/80 mt-1">{availabilityMessage}</p>
                      </div>
                    </div>
                  )}
                </Card>
              </motion.div>

              {/* Delivery */}
              <motion.div variants={staggerItemVariants}>
                <Card variant="glass" padding="lg">
                  <h3 className="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-gold text-bg-primary text-sm font-bold flex items-center justify-center">3</span>
                    Odbiór / Dostawa
                  </h3>
                  
                  <div className="space-y-4">
                    {/* Dowóz i odbiór to dwa niezależne kursy — klient może chcieć tylko jednego. */}
                    <div className="p-4 rounded-lg bg-bg-primary/50 border border-border space-y-3">
                      <p className="text-sm text-text-secondary">
                        Domyślnie odbierasz i oddajesz sprzęt w naszym punkcie —{' '}
                        <span className="text-text-primary">{OFFICE_ADDRESS}</span>. Możesz zamówić dojazd
                        w jedną albo w obie strony.
                      </p>

                      <label className="flex items-start gap-3 p-3 rounded-lg border border-border hover:border-border-hover cursor-pointer transition-colors">
                        <input
                          type="checkbox"
                          className="mt-1 w-4 h-4 accent-gold"
                          checked={formData.deliveryOut}
                          onChange={(e) => updateField('deliveryOut', e.target.checked)}
                        />
                        <span className="flex-1">
                          <span className="flex items-center gap-2 flex-wrap">
                            <Truck className="w-4 h-4 text-gold-light light:text-gold-dark" />
                            <span className="font-medium text-text-primary">Przywieziemy sprzęt</span>
                            <span className="text-xs text-gold-light light:text-gold-dark font-medium">+20 zł</span>
                          </span>
                          <span className="block text-xs text-text-muted mt-1">
                            Dojazd pod Twój adres w dniu rozpoczęcia najmu
                          </span>
                        </span>
                      </label>

                      <label className="flex items-start gap-3 p-3 rounded-lg border border-border hover:border-border-hover cursor-pointer transition-colors">
                        <input
                          type="checkbox"
                          className="mt-1 w-4 h-4 accent-gold"
                          checked={formData.deliveryBack}
                          onChange={(e) => updateField('deliveryBack', e.target.checked)}
                        />
                        <span className="flex-1">
                          <span className="flex items-center gap-2 flex-wrap">
                            <Home className="w-4 h-4 text-gold-light light:text-gold-dark" />
                            <span className="font-medium text-text-primary">Odbierzemy sprzęt</span>
                            <span className="text-xs text-gold-light light:text-gold-dark font-medium">+20 zł</span>
                          </span>
                          <span className="block text-xs text-text-muted mt-1">
                            Przyjedziemy po sprzęt w dniu zakończenia najmu
                          </span>
                        </span>
                      </label>

                      {(formData.deliveryOut || formData.deliveryBack) && (
                        <div className="pt-3 border-t border-border space-y-4">
                          <div className="grid grid-cols-1 sm:grid-cols-[140px_1fr] gap-4">
                            <Input
                              label="Kod pocztowy"
                              placeholder="35-000"
                              inputMode="numeric"
                              value={formData.postalCode}
                              onChange={(e) => updateField('postalCode', formatujKod(e.target.value))}
                              leftIcon={<MapPin className="w-4 h-4" />}
                              required
                            />
                            <Input
                              label="Adres"
                              placeholder="Ulica, nr domu/mieszkania"
                              value={formData.address}
                              onChange={(e) => updateField('address', e.target.value)}
                              required
                            />
                          </div>

                          {deliveryDistanceStatus === 'checking' && (
                            <div className="p-3 rounded-lg bg-gold/10 border border-gold/20 flex items-center gap-2">
                              <Loader2 className="w-4 h-4 text-gold-light light:text-gold-dark animate-spin" />
                              <p className="text-sm text-gold-light light:text-gold-dark">Sprawdzam obszar dowozu…</p>
                            </div>
                          )}

                          {deliveryDistanceStatus === 'ok' && deliveryDistanceMessage && (
                            <div className="p-3 rounded-lg bg-success/10 border border-success/20 flex items-center gap-2">
                              <CheckCircle2 className="w-4 h-4 text-success" />
                              <p className="text-sm text-success">{deliveryDistanceMessage}</p>
                            </div>
                          )}

                          {deliveryDistanceStatus === 'too_far' && deliveryDistanceMessage && (
                            <div className="p-3 rounded-lg bg-error/10 border border-error/20 flex items-start gap-2">
                              <AlertCircle className="w-5 h-5 text-error shrink-0 mt-0.5" />
                              <div>
                                <p className="text-sm font-semibold text-error">Poza obszarem dowozu</p>
                                <p className="text-xs text-error/80 mt-1">{deliveryDistanceMessage}</p>
                                <p className="text-xs text-text-muted mt-2">
                                  Odznacz dojazd, żeby odebrać sprzęt osobiście, albo zadzwoń: <strong>570 038 828</strong>
                                </p>
                              </div>
                            </div>
                          )}

                          {deliveryDistanceStatus === 'idle' && deliveryDistanceMessage && (
                            <div className="p-3 rounded-lg bg-warning/10 border border-warning/20 flex items-center gap-2">
                              <AlertCircle className="w-4 h-4 text-warning" />
                              <p className="text-sm text-warning">{deliveryDistanceMessage}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {isWeekendPickup && (
                      <div className="p-3 rounded-lg bg-gold/10 border border-gold/20 flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-gold-light light:text-gold-dark" />
                        <p className="text-sm text-gold-light light:text-gold-dark">
                          Obsługa w weekend — doliczamy 30 zł za każde wydanie lub zwrot przypadające
                          w sobotę, niedzielę albo święto
                        </p>
                      </div>
                    )}
                  </div>
                </Card>
              </motion.div>

              {/* Contact */}
              <motion.div variants={staggerItemVariants}>
                <Card variant="glass" padding="lg">
                  <h3 className="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-gold text-bg-primary text-sm font-bold flex items-center justify-center">4</span>
                    Dane kontaktowe
                  </h3>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Input
                      label="Imię"
                      placeholder="Jan"
                      value={formData.firstName}
                      onChange={(e) => updateField('firstName', e.target.value)}
                      leftIcon={<User className="w-4 h-4" />}
                      required
                    />
                    <Input
                      label="Nazwisko"
                      placeholder="Kowalski"
                      value={formData.lastName}
                      onChange={(e) => updateField('lastName', e.target.value)}
                      required
                    />
                    <Input
                      label="Email"
                      type="email"
                      placeholder="jan@example.com"
                      value={formData.email}
                      onChange={(e) => updateField('email', e.target.value)}
                      leftIcon={<Mail className="w-4 h-4" />}
                      required
                    />
                    <Input
                      label="Telefon"
                      type="tel"
                      placeholder="+48 123 456 789"
                      value={formData.phone}
                      onChange={(e) => updateField('phone', e.target.value)}
                      leftIcon={<Phone className="w-4 h-4" />}
                      required
                    />
                  </div>

                  {/* Invoice Section */}
                  <div className="mt-4 border border-border rounded-[--radius-sm] overflow-hidden">
                    <button
                      type="button"
                      onClick={() => updateField('wantsInvoice', !formData.wantsInvoice)}
                      className="w-full flex items-center justify-between p-4 bg-bg-card/50 hover:bg-bg-card transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                          formData.wantsInvoice 
                            ? 'bg-gold border-gold' 
                            : 'border-border'
                        }`}>
                          {formData.wantsInvoice && (
                            <CheckCircle2 className="w-3.5 h-3.5 text-bg-primary" />
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-gold" />
                          <span className="font-medium text-text-primary">Chcę fakturę VAT</span>
                        </div>
                      </div>
                      <ChevronDown className={`w-5 h-5 text-text-muted transition-transform ${
                        formData.wantsInvoice ? 'rotate-180' : ''
                      }`} />
                    </button>
                    
                    {formData.wantsInvoice && (
                      <div className="p-4 border-t border-border bg-bg-primary/30 space-y-4">
                        <Input
                          label="NIP"
                          placeholder="1234567890"
                          value={formData.invoiceNip}
                          onChange={(e) => updateField('invoiceNip', e.target.value)}
                          leftIcon={<FileText className="w-4 h-4" />}
                        />
                        <Input
                          label="Nazwa firmy"
                          placeholder="Nazwa firmy do faktury"
                          value={formData.invoiceCompany}
                          onChange={(e) => updateField('invoiceCompany', e.target.value)}
                          leftIcon={<Building2 className="w-4 h-4" />}
                        />
                        <Input
                          label="Adres firmy"
                          placeholder="ul. Przykładowa 1, 00-000 Miasto"
                          value={formData.invoiceAddress}
                          onChange={(e) => updateField('invoiceAddress', e.target.value)}
                          leftIcon={<MapPin className="w-4 h-4" />}
                        />
                      </div>
                    )}
                  </div>

                  <div className="mt-4">
                    <Textarea
                      label="Uwagi (opcjonalnie)"
                      placeholder="Dodatkowe informacje do rezerwacji..."
                      value={formData.notes}
                      onChange={(e) => updateField('notes', e.target.value)}
                      rows={3}
                    />
                  </div>
                </Card>
              </motion.div>

              {/* Terms */}
              <motion.div variants={staggerItemVariants}>
                <Card variant="glass" padding="lg">
                  <h3 className="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-gold text-bg-primary text-sm font-bold flex items-center justify-center">5</span>
                    Zgody
                  </h3>
                  
                  <div className="space-y-3">
                    <label className="flex items-start gap-3 cursor-pointer group">
                      <input spellCheck={false}
                        type="checkbox"
                        checked={formData.acceptTerms}
                        onChange={(e) => updateField('acceptTerms', e.target.checked)}
                        className="mt-1 w-4 h-4 rounded border-border bg-bg-card text-gold focus:ring-gold"
                        required
                      />
                      <span className="text-sm text-text-secondary group-hover:text-text-primary transition-colors">
                        Akceptuję <a href="/regulamin" target="_blank" className="text-gold hover:underline">regulamin</a> wypożyczalni WB-Rent *
                      </span>
                    </label>
                    
                    <label className="flex items-start gap-3 cursor-pointer group">
                      <input spellCheck={false}
                        type="checkbox"
                        checked={formData.acceptRodo}
                        onChange={(e) => updateField('acceptRodo', e.target.checked)}
                        className="mt-1 w-4 h-4 rounded border-border bg-bg-card text-gold focus:ring-gold"
                        required
                      />
                      <span className="text-sm text-text-secondary group-hover:text-text-primary transition-colors">
                        Wyrażam zgodę na przetwarzanie moich danych osobowych zgodnie z <a href="/polityka-prywatnosci" target="_blank" className="text-gold hover:underline">polityką prywatności</a> *
                      </span>
                    </label>
                  </div>
                </Card>
              </motion.div>
            </div>

            {/* Right Column - Summary */}
            <motion.div variants={staggerItemVariants} className="lg:sticky lg:top-24 lg:self-start">
              <Card variant="glow" padding="lg">
                <h3 className="text-lg font-semibold text-text-primary mb-6">
                  Podsumowanie
                </h3>

                {/* Selected product */}
                {selectedProduct ? (
                  <div className="space-y-4">
                    <div className="p-4 rounded-lg bg-bg-primary/50 border border-border">
                      <p className="font-medium text-text-primary">{selectedProduct.name}</p>
                      <p className="text-sm text-text-muted mt-1">
                        {rentalDays > 0 ? `${rentalDays} ${rentalDays === 1 ? 'dzień' : 'dni'}` : 'Wybierz daty'}
                      </p>
                    </div>

                    {/* Cost breakdown */}
                    {costSummary && (
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-text-secondary">Wynajem:</span>
                          <span className="text-text-primary">{formatPrice(costSummary.basePrice)}</span>
                        </div>
                        {costSummary.deliveryFee > 0 && (
                          <div className="flex justify-between">
                            <span className="text-text-secondary">
                              {formData.deliveryOut && formData.deliveryBack
                                ? 'Dowóz i odbiór:'
                                : formData.deliveryOut ? 'Dowóz sprzętu:' : 'Odbiór sprzętu:'}
                            </span>
                            <span className="text-text-primary">{formatPrice(costSummary.deliveryFee)}</span>
                          </div>
                        )}
                        {costSummary.weekendPickupFee > 0 && (
                          <div className="flex justify-between">
                            <span className="text-text-secondary">
                              Obsługa w weekend{zdarzeniaWeekendowe > 1 ? ' (×2)' : ''}:
                            </span>
                            <span className="text-text-primary">{formatPrice(costSummary.weekendPickupFee)}</span>
                          </div>
                        )}
                        {appliedCoupon && appliedCoupon.discountAmount > 0 && (
                          <div className="flex justify-between">
                            <span className="text-emerald-400 light:text-emerald-700">Kupon {appliedCoupon.code}:</span>
                            <span className="text-emerald-400 light:text-emerald-700">-{formatPrice(appliedCoupon.discountAmount)}</span>
                          </div>
                        )}
                        <div className="border-t border-border pt-2 mt-2">
                          <div className="flex justify-between">
                            <span className="font-medium text-text-primary">Razem:</span>
                            <span className="text-xl font-bold text-gold">
                              {formatPrice(Math.max(costSummary.total - (appliedCoupon?.discountAmount || 0), 0))}
                            </span>
                          </div>
                        </div>

                        {/* Coupon code */}
                        <div className="pt-3 mt-1 border-t border-border">
                          {appliedCoupon ? (
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs text-emerald-400 light:text-emerald-700">
                                Kupon {appliedCoupon.code} został naliczony
                              </span>
                              <button
                                type="button"
                                onClick={removeCoupon}
                                className="text-xs text-text-muted hover:text-text-primary underline"
                              >
                                Usuń
                              </button>
                            </div>
                          ) : (
                            <>
                              <label htmlFor="couponCode" className="block text-xs text-text-secondary mb-1.5">
                                Masz kupon rabatowy?
                              </label>
                              <div className="flex gap-2">
                                <input spellCheck={false}
                                  id="couponCode"
                                  value={formData.couponCode}
                                  onChange={(event) => updateField('couponCode', event.target.value.toUpperCase())}
                                  onKeyDown={(event) => {
                                    if (event.key === 'Enter') {
                                      event.preventDefault();
                                      void applyCoupon();
                                    }
                                  }}
                                  placeholder="WBR-XXXX-XXXX"
                                  autoComplete="off"
                                  className="flex-1 min-w-0 h-10 px-3 rounded-lg bg-bg-card border border-border text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-gold uppercase"
                                />
                                <button
                                  type="button"
                                  onClick={() => void applyCoupon()}
                                  disabled={couponStatus === 'checking' || !formData.couponCode.trim()}
                                  className="h-10 px-4 rounded-lg border border-gold/40 text-sm font-medium text-gold-light light:text-gold-dark hover:bg-gold/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                >
                                  {couponStatus === 'checking' ? 'Sprawdzam…' : 'Zastosuj'}
                                </button>
                              </div>
                            </>
                          )}
                          {couponMessage && (
                            <p
                              role="status"
                              className={`mt-2 text-xs ${couponStatus === 'invalid' ? 'text-red-400 light:text-red-700' : 'text-emerald-400 light:text-emerald-700'}`}
                            >
                              {couponMessage}
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8 text-text-muted">
                    <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>Wybierz sprzęt i daty, aby zobaczyć podsumowanie</p>
                  </div>
                )}

                {/* Error message */}
                {status === 'error' && errorMessage && (
                  <div className="mt-4 p-3 rounded-lg bg-error/10 border border-error/20 flex items-start gap-2">
                    <AlertCircle className="w-5 h-5 text-error shrink-0 mt-0.5" />
                    <p className="text-sm text-error">{errorMessage}</p>
                  </div>
                )}

                {/* Availability error */}
                {availabilityStatus === 'unavailable' && availabilityMessage && (
                  <div className="mt-4 p-4 rounded-lg bg-error/10 border border-error/30 flex items-start gap-3">
                    <AlertCircle className="w-6 h-6 text-error shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-error mb-1">Termin niedostępny</p>
                      <p className="text-sm text-error/80">{availabilityMessage}</p>
                    </div>
                  </div>
                )}

                {/* Submit button */}
                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  className="w-full mt-6"
                  disabled={status === 'loading' || availabilityStatus === 'checking'}
                >
                  {status === 'loading' || availabilityStatus === 'checking' ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin mr-2" />
                      {availabilityStatus === 'checking' ? 'Sprawdzanie dostępności...' : 'Wysyłanie...'}
                    </>
                  ) : (
                    <>
                      <Send className="w-5 h-5 mr-2" />
                      Wyślij rezerwację
                    </>
                  )}
                </Button>

                <p className="text-xs text-text-muted text-center mt-4">
                  Rezerwacja wymaga potwierdzenia. Skontaktujemy się w ciągu 24h.
                </p>
              </Card>
            </motion.div>
          </motion.form>
        )}
      </div>
    </section>
  );
}
