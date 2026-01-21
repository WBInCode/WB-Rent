import { useState, useMemo, useEffect, useCallback } from 'react';
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
  ChevronDown
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
import { submitReservation, checkAvailability, type ReservationPayload } from '@/services/api';
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
  city: string;
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
  city: '',
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

// Współrzędne Rzeszowa do obliczania odległości
const RZESZOW_COORDS = { lat: 50.0412, lng: 21.9991 };

// Funkcja do obliczania odległości (haversine formula)
const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
  const R = 6371; // Promień Ziemi w km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

export function Reservation() {
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [availabilityStatus, setAvailabilityStatus] = useState<'idle' | 'checking' | 'available' | 'unavailable'>('idle');
  const [availabilityMessage, setAvailabilityMessage] = useState<string | null>(null);
  
  // Stan dla sprawdzania odległości dostawy
  const [deliveryDistanceStatus, setDeliveryDistanceStatus] = useState<'idle' | 'checking' | 'ok' | 'too_far'>('idle');
  const [deliveryDistanceMessage, setDeliveryDistanceMessage] = useState<string | null>(null);

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
    onSuccess: () => {
      setFormData(initialFormData);
      setValidationError(null);
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
    return start.getDay() === 5 && rentalDays <= 3;
  }, [formData.startDate, rentalDays]);

  // Check if pickup is on weekend (Saturday=6 or Sunday=0)
  const isWeekendPickup = useMemo(() => {
    if (!formData.startDate) return false;
    const start = new Date(formData.startDate);
    const day = start.getDay();
    return day === 0 || day === 6; // Sunday or Saturday
  }, [formData.startDate]);

  // Calculate cost
  const costSummary = useMemo(() => {
    if (!formData.productId || rentalDays === 0) return null;
    return calculateRentalCost(
      formData.productId, 
      rentalDays, 
      formData.delivery, 
      isWeekendRental,
      isWeekendPickup // automatycznie na podstawie daty
    );
  }, [formData.productId, rentalDays, formData.delivery, isWeekendRental, isWeekendPickup]);

  // Auto-check availability when product/dates change
  useEffect(() => {
    // Reset if missing required fields
    if (!formData.productId || !formData.startDate || !formData.endDate || rentalDays === 0) {
      setAvailabilityStatus('idle');
      setAvailabilityMessage(null);
      return;
    }

    // Debounce the check
    const timeoutId = setTimeout(async () => {
      setAvailabilityStatus('checking');
      
      try {
        const result = await checkAvailability(
          formData.productId,
          formData.startDate,
          formData.endDate
        );

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
        setAvailabilityStatus('idle');
      }
    }, 500); // 500ms debounce

    return () => clearTimeout(timeoutId);
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
    }

    // Reset delivery distance when delivery is toggled off or address changes
    if (field === 'delivery' && value === false) {
      setDeliveryDistanceStatus('idle');
      setDeliveryDistanceMessage(null);
    }
  };

  // Funkcja do sprawdzania odległości adresu od Rzeszowa (używa Nominatim/OpenStreetMap)
  const checkDeliveryDistance = useCallback(async (address: string, city: string) => {
    // Wymaga przynajmniej miasta
    if (!city) {
      setDeliveryDistanceStatus('idle');
      setDeliveryDistanceMessage(null);
      return;
    }

    setDeliveryDistanceStatus('checking');
    setDeliveryDistanceMessage(null);

    try {
      // Jeśli jest adres, szukaj pełnego adresu, w przeciwnym razie szukaj tylko miasta
      const searchQuery = address ? `${address}, ${city}, Polska` : `${city}, Polska`;
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=1`,
        { headers: { 'Accept-Language': 'pl' } }
      );
      
      if (!response.ok) {
        throw new Error('Geocoding failed');
      }

      const data = await response.json();
      
      if (data.length === 0) {
        // Nie znaleziono adresu - spróbuj tylko z miastem jeśli szukaliśmy pełnego adresu
        if (address) {
          const cityResponse = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(city + ', Polska')}&limit=1`,
            { headers: { 'Accept-Language': 'pl' } }
          );
          const cityData = await cityResponse.json();
          
          if (cityData.length === 0) {
            setDeliveryDistanceStatus('idle');
            setDeliveryDistanceMessage('Nie udało się zweryfikować adresu. Skontaktuj się z nami telefonicznie.');
            return;
          }
          
          const distance = calculateDistance(
            RZESZOW_COORDS.lat,
            RZESZOW_COORDS.lng,
            parseFloat(cityData[0].lat),
            parseFloat(cityData[0].lon)
          );
          
          if (distance > 30) {
            setDeliveryDistanceStatus('too_far');
            setDeliveryDistanceMessage(`Za daleko (${Math.round(distance)} km). Max 30 km od Rzeszowa.`);
          } else {
            setDeliveryDistanceStatus('ok');
            setDeliveryDistanceMessage(`OK - ${Math.round(distance)} km od Rzeszowa`);
          }
          return;
        }
        
        setDeliveryDistanceStatus('idle');
        setDeliveryDistanceMessage('Nie znaleziono miasta. Sprawdź pisownię.');
        return;
      }

      const { lat, lon } = data[0];
      const distance = calculateDistance(
        RZESZOW_COORDS.lat,
        RZESZOW_COORDS.lng,
        parseFloat(lat),
        parseFloat(lon)
      );

      if (distance > 30) {
        setDeliveryDistanceStatus('too_far');
        setDeliveryDistanceMessage(`Za daleko (${Math.round(distance)} km). Max 30 km od Rzeszowa.`);
      } else {
        setDeliveryDistanceStatus('ok');
        setDeliveryDistanceMessage(`OK - ${Math.round(distance)} km od Rzeszowa`);
      }
    } catch (error) {
      console.error('Distance check error:', error);
      setDeliveryDistanceStatus('idle');
      setDeliveryDistanceMessage('Błąd sprawdzania. Spróbuj ponownie.');
    }
  }, []);

  // Sprawdzanie odległości dostawy - z debounce żeby nie spamować API
  useEffect(() => {
    if (!formData.delivery || !formData.city) {
      setDeliveryDistanceStatus('idle');
      setDeliveryDistanceMessage(null);
      return;
    }

    // Minimum 3 znaki żeby szukać
    if (formData.city.length < 3) {
      setDeliveryDistanceStatus('idle');
      setDeliveryDistanceMessage(null);
      return;
    }

    // Pokaż "sprawdzam" od razu
    setDeliveryDistanceStatus('checking');

    // Debounce 600ms - czekaj aż użytkownik skończy pisać
    const timeoutId = setTimeout(() => {
      checkDeliveryDistance(formData.address, formData.city);
    }, 600);

    return () => clearTimeout(timeoutId);
  }, [formData.delivery, formData.city, formData.address, checkDeliveryDistance]);

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

    // Block if delivery address is too far
    if (formData.delivery && deliveryDistanceStatus === 'too_far') {
      setValidationError('Adres dostawy jest poza zasięgiem (max 30 km od Rzeszowa). Wybierz odbiór osobisty lub zmień adres.');
      return;
    }

    // Block if delivery distance is still checking
    if (formData.delivery && deliveryDistanceStatus === 'checking') {
      setValidationError('Poczekaj na weryfikację adresu dostawy...');
      return;
    }

    // Block if delivery address is missing
    if (formData.delivery && (!formData.city || !formData.address)) {
      setValidationError('Podaj pełny adres dostawy (miasto i adres).');
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
      delivery: formData.delivery,
      city: formData.delivery ? formData.city : undefined,
      address: formData.delivery ? formData.address : undefined,
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
      totalPrice: costSummary.total,
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
          <span className="inline-block text-gold text-sm font-medium tracking-wider uppercase mb-4">
            Formularz rezerwacji
          </span>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-text-primary mb-4">
            Zarezerwuj sprzęt
          </h2>
          <p className="text-lg text-text-secondary max-w-2xl mx-auto">
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
                          <span key={f} className="text-xs px-2 py-1 rounded bg-gold/10 text-gold">
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
                  <div className="p-3 rounded-lg bg-gold/10 border border-gold/20 mb-3">
                    <p className="text-xs text-gold">
                      💡 Doba trwa 24h od godziny odbioru. Przykład: odbiór 21.01 o 09:00 = zwrot do 22.01 do 09:00 (1 doba). Zwrot po tej godzinie = dodatkowa doba.
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
                      <Loader2 className="w-4 h-4 text-gold animate-spin" />
                      <p className="text-sm text-gold">Sprawdzanie dostępności...</p>
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
                    {/* Odbiór osobisty - domyślnie */}
                    <div className="p-4 rounded-lg bg-bg-primary/50 border border-border">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-full bg-gold/20 flex items-center justify-center shrink-0">
                          <Home className="w-5 h-5 text-gold" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <input
                              type="radio"
                              id="pickup-personal"
                              name="deliveryOption"
                              checked={!formData.delivery}
                              onChange={() => updateField('delivery', false)}
                              className="w-4 h-4 text-gold accent-gold"
                            />
                            <label htmlFor="pickup-personal" className="font-medium text-text-primary cursor-pointer">
                              Odbiór osobisty
                            </label>
                            <span className="text-xs text-success font-medium">Bezpłatnie</span>
                          </div>
                          <p className="text-sm text-text-muted mt-1 ml-6">
                            <MapPin className="w-3 h-3 inline mr-1" />
                            {OFFICE_ADDRESS}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Dostawa pod adres */}
                    <div className={`p-4 rounded-lg border transition-colors ${formData.delivery ? 'bg-gold/5 border-gold/30' : 'bg-bg-primary/50 border-border'}`}>
                      <div className="flex items-start gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${formData.delivery ? 'bg-gold/20' : 'bg-bg-secondary'}`}>
                          <Truck className={`w-5 h-5 ${formData.delivery ? 'text-gold' : 'text-text-muted'}`} />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <input
                              type="radio"
                              id="pickup-delivery"
                              name="deliveryOption"
                              checked={formData.delivery}
                              onChange={() => updateField('delivery', true)}
                              className="w-4 h-4 text-gold accent-gold"
                            />
                            <label htmlFor="pickup-delivery" className="font-medium text-text-primary cursor-pointer">
                              Dostawa pod adres
                            </label>
                            <span className="text-xs text-gold font-medium">+40 zł</span>
                          </div>
                          <p className="text-xs text-text-muted mt-1 ml-6">
                            Maksymalny zasięg: 30 km od Rzeszowa
                          </p>
                        </div>
                      </div>

                      {formData.delivery && (
                        <div className="mt-4 ml-13 space-y-4">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <Input
                              label="Miasto"
                              placeholder="Np. Rzeszów, Łańcut, Krosno..."
                              value={formData.city}
                              onChange={(e) => updateField('city', e.target.value)}
                              leftIcon={<MapPin className="w-4 h-4" />}
                              required={formData.delivery}
                            />
                            <Input
                              label="Adres"
                              placeholder="Ulica, nr domu/mieszkania"
                              value={formData.address}
                              onChange={(e) => updateField('address', e.target.value)}
                              required={formData.delivery}
                            />
                          </div>
                          
                          {/* Status sprawdzania odległości */}
                          {deliveryDistanceStatus === 'checking' && (
                            <div className="p-3 rounded-lg bg-gold/10 border border-gold/20 flex items-center gap-2">
                              <Loader2 className="w-4 h-4 text-gold animate-spin" />
                              <p className="text-sm text-gold">Sprawdzanie odległości...</p>
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
                                <p className="text-sm font-semibold text-error">Adres poza zasięgiem dostawy</p>
                                <p className="text-xs text-error/80 mt-1">{deliveryDistanceMessage}</p>
                                <p className="text-xs text-text-muted mt-2">
                                  Wybierz odbiór osobisty lub skontaktuj się z nami: <strong>570 038 828</strong>
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
                        <AlertCircle className="w-4 h-4 text-gold" />
                        <p className="text-sm text-gold">
                          Odbiór w weekend - doliczono opłatę +30 zł
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
                  <div className="mt-4 border border-border rounded-xl overflow-hidden">
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
                      <input
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
                      <input
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
                            <span className="text-text-secondary">Transport:</span>
                            <span className="text-text-primary">{formatPrice(costSummary.deliveryFee)}</span>
                          </div>
                        )}
                        {costSummary.weekendPickupFee > 0 && (
                          <div className="flex justify-between">
                            <span className="text-text-secondary">Odbiór weekend:</span>
                            <span className="text-text-primary">{formatPrice(costSummary.weekendPickupFee)}</span>
                          </div>
                        )}
                        <div className="border-t border-border pt-2 mt-2">
                          <div className="flex justify-between">
                            <span className="font-medium text-text-primary">Razem:</span>
                            <span className="text-xl font-bold text-gold">{formatPrice(costSummary.total)}</span>
                          </div>
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
