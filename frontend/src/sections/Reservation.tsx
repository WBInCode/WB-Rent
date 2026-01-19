import { useState, useMemo } from 'react';
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
  Send
} from 'lucide-react';
import { Card, Input, Select, Toggle, Button, Textarea } from '@/components/ui';
import { 
  categories, 
  getProductsByCategory, 
  calculateRentalCost, 
  getProductById,
  type Product 
} from '@/data/products';
import { formatPrice, calculateDays } from '@/lib/utils';
import { staggerContainerVariants, staggerItemVariants, revealVariants } from '@/lib/motion';
import { useSubmitForm } from '@/hooks';
import { submitReservation, type ReservationPayload } from '@/services/api';

interface FormData {
  // Product selection
  categoryId: string;
  productId: string;
  // Dates
  startDate: string;
  endDate: string;
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
  delivery: false,
  city: '',
  address: '',
  weekendPickup: false,
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  company: '',
  notes: '',
  acceptTerms: false,
  acceptRodo: false,
};

export function Reservation() {
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [validationError, setValidationError] = useState<string | null>(null);

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

  // Calculate rental days
  const rentalDays = useMemo(() => {
    if (!formData.startDate || !formData.endDate) return 0;
    const start = new Date(formData.startDate);
    const end = new Date(formData.endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) return 0;
    return calculateDays(start, end);
  }, [formData.startDate, formData.endDate]);

  // Check if weekend rental
  const isWeekendRental = useMemo(() => {
    if (!formData.startDate) return false;
    const start = new Date(formData.startDate);
    return start.getDay() === 5 && rentalDays <= 3;
  }, [formData.startDate, rentalDays]);

  // Calculate cost
  const costSummary = useMemo(() => {
    if (!formData.productId || rentalDays === 0) return null;
    return calculateRentalCost(
      formData.productId, 
      rentalDays, 
      formData.delivery, 
      isWeekendRental,
      formData.weekendPickup
    );
  }, [formData.productId, rentalDays, formData.delivery, isWeekendRental, formData.weekendPickup]);

  // Update form field
  const updateField = <K extends keyof FormData>(field: K, value: FormData[K]) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    
    // Reset product when category changes
    if (field === 'categoryId') {
      setFormData((prev) => ({ ...prev, productId: '' }));
    }
  };

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

    // Prepare payload for API
    const payload: ReservationPayload = {
      productId: formData.productId,
      productName: selectedProduct.name,
      categoryId: formData.categoryId,
      startDate: formData.startDate,
      endDate: formData.endDate,
      days: rentalDays,
      delivery: formData.delivery,
      city: formData.delivery ? formData.city : undefined,
      address: formData.delivery ? formData.address : undefined,
      weekendPickup: formData.weekendPickup,
      firstName: formData.firstName,
      lastName: formData.lastName,
      email: formData.email,
      phone: formData.phone,
      company: formData.company || undefined,
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
                <Card variant="glass" padding="lg">
                  <h3 className="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-gold text-bg-primary text-sm font-bold flex items-center justify-center">2</span>
                    Termin wynajmu
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Input
                      label="Data rozpoczęcia"
                      type="date"
                      value={formData.startDate}
                      onChange={(e) => updateField('startDate', e.target.value)}
                      leftIcon={<Calendar className="w-4 h-4" />}
                      required
                    />
                    <Input
                      label="Data zakończenia"
                      type="date"
                      value={formData.endDate}
                      onChange={(e) => updateField('endDate', e.target.value)}
                      leftIcon={<Calendar className="w-4 h-4" />}
                      required
                    />
                  </div>
                  {rentalDays > 0 && (
                    <p className="text-sm text-text-muted mt-2">
                      Czas wynajmu: <span className="text-gold font-medium">{rentalDays} {rentalDays === 1 ? 'dzień' : 'dni'}</span>
                      {isWeekendRental && <span className="ml-2 text-success">(cena weekendowa)</span>}
                    </p>
                  )}
                </Card>
              </motion.div>

              {/* Delivery */}
              <motion.div variants={staggerItemVariants}>
                <Card variant="glass" padding="lg">
                  <h3 className="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-gold text-bg-primary text-sm font-bold flex items-center justify-center">3</span>
                    Dostawa
                  </h3>
                  
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Toggle
                        label="Zamów dostawę"
                        description="Transport pod wskazany adres (+40 zł)"
                        checked={formData.delivery}
                        onChange={(e) => updateField('delivery', e.target.checked)}
                      />
                      <Truck className="w-5 h-5 text-text-muted" />
                    </div>

                    {formData.delivery && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-border">
                        <Input
                          label="Miasto"
                          placeholder="Np. Warszawa"
                          value={formData.city}
                          onChange={(e) => updateField('city', e.target.value)}
                          leftIcon={<MapPin className="w-4 h-4" />}
                          required={formData.delivery}
                        />
                        <Input
                          label="Adres"
                          placeholder="Ulica, nr domu"
                          value={formData.address}
                          onChange={(e) => updateField('address', e.target.value)}
                          required={formData.delivery}
                        />
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-2">
                      <Toggle
                        label="Odbiór w weekend"
                        description="Sobota lub niedziela (+30 zł)"
                        checked={formData.weekendPickup}
                        onChange={(e) => updateField('weekendPickup', e.target.checked)}
                      />
                    </div>
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
                    <div className="sm:col-span-2">
                      <Input
                        label="Firma (opcjonalnie)"
                        placeholder="Nazwa firmy"
                        value={formData.company}
                        onChange={(e) => updateField('company', e.target.value)}
                        leftIcon={<Building2 className="w-4 h-4" />}
                      />
                    </div>
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
                        Akceptuję <a href="#" className="text-gold hover:underline">regulamin</a> wypożyczalni WB-Rent *
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
                        Wyrażam zgodę na przetwarzanie moich danych osobowych zgodnie z <a href="#" className="text-gold hover:underline">polityką prywatności</a> *
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

                {/* Submit button */}
                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  className="w-full mt-6"
                  disabled={status === 'loading'}
                >
                  {status === 'loading' ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin mr-2" />
                      Wysyłanie...
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
