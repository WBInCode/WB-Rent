import { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Calendar, MapPin, Truck, ArrowRight, Calculator, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { Card, Select, Input, Toggle, Button } from '@/components/ui';
import { categories, getProductsByCategory, calculateRentalCost, type Product } from '@/data/products';
import { formatPrice, calculateDays } from '@/lib/utils';
import { revealVariants } from '@/lib/motion';
import { useReservationContext } from '@/context/ReservationContext';
import { checkAvailability } from '@/services/api';

export function CostWidget() {
  const [categoryId, setCategoryId] = useState('');
  const [productId, setProductId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [city, setCity] = useState('');
  const [delivery, setDelivery] = useState(false);
  
  // Availability checking
  const [availabilityStatus, setAvailabilityStatus] = useState<'idle' | 'checking' | 'available' | 'unavailable'>('idle');
  const [availabilityMessage, setAvailabilityMessage] = useState<string | null>(null);

  const { setPreFillData } = useReservationContext();

  // Get products for selected category
  const availableProducts = useMemo(() => {
    if (!categoryId) return [];
    return getProductsByCategory(categoryId).filter((p) => p.available);
  }, [categoryId]);

  // Calculate rental days
  const rentalDays = useMemo(() => {
    if (!startDate || !endDate) return 0;
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) return 0;
    return calculateDays(start, end);
  }, [startDate, endDate]);

  // Calculate cost
  const costSummary = useMemo(() => {
    if (!productId || !startDate || !endDate) return null;
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) {
      return null;
    }

    const days = calculateDays(start, end);
    
    // Check if it's a weekend rental (Fri-Mon)
    const startDay = start.getDay();
    const isWeekend = startDay === 5 && days <= 3; // Friday start, max 3 days
    
    return calculateRentalCost(productId, days, delivery, isWeekend);
  }, [productId, startDate, endDate, delivery]);

  // Auto-check availability when product/dates change
  useEffect(() => {
    if (!productId || !startDate || !endDate || rentalDays === 0) {
      setAvailabilityStatus('idle');
      setAvailabilityMessage(null);
      return;
    }

    const timeoutId = setTimeout(async () => {
      setAvailabilityStatus('checking');
      
      try {
        const result = await checkAvailability(productId, startDate, endDate);
        
        if (result.success && result.data?.available) {
          setAvailabilityStatus('available');
          setAvailabilityMessage('Termin dostępny!');
        } else {
          setAvailabilityStatus('unavailable');
          setAvailabilityMessage(result.data?.message || 'Termin niedostępny');
        }
      } catch {
        setAvailabilityStatus('idle');
        setAvailabilityMessage(null);
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [productId, startDate, endDate, rentalDays]);

  // Reset product when category changes
  const handleCategoryChange = (value: string) => {
    setCategoryId(value);
    setProductId('');
  };

  const handleReservation = () => {
    // Save data to context
    setPreFillData({
      categoryId,
      productId,
      startDate,
      endDate,
      city,
      delivery,
    });
    
    // Scroll to reservation form
    const element = document.getElementById('rezerwacja');
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <motion.div
      variants={revealVariants}
      initial="hidden"
      animate="visible"
    >
      <Card variant="glow" className="p-6 md:p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-semibold text-text-primary">Sprawdź koszty</h3>
          <Calculator className="w-5 h-5 text-gold" />
        </div>

        {/* Form */}
        <div className="space-y-4">
          {/* Category & Product Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="Kategoria"
              placeholder="Wybierz kategorię"
              value={categoryId}
              onChange={(e) => handleCategoryChange(e.target.value)}
              options={categories.map((c) => ({ value: c.id, label: c.name }))}
            />
            <Select
              label="Urządzenie"
              placeholder="Wybierz urządzenie"
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              options={availableProducts.map((p: Product) => ({ value: p.id, label: p.name }))}
              disabled={!categoryId}
            />
          </div>

          {/* Dates Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Data rozpoczęcia"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              leftIcon={<Calendar className="w-4 h-4" />}
            />
            <Input
              label="Data zakończenia"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              leftIcon={<Calendar className="w-4 h-4" />}
            />
          </div>

          {/* City */}
          <Input
            label="Miasto"
            placeholder="Np. Warszawa"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            leftIcon={<MapPin className="w-4 h-4" />}
          />

          {/* Delivery Toggle */}
          <div className="flex items-center justify-between py-2">
            <Toggle
              label="Dostawa"
              description="Opcja z transportem"
              checked={delivery}
              onChange={(e) => setDelivery(e.target.checked)}
            />
            <Truck className="w-5 h-5 text-text-muted" />
          </div>

          {/* Availability Status */}
          {availabilityStatus !== 'idle' && (
            <div className={`flex items-center gap-2 p-3 rounded-lg ${
              availabilityStatus === 'checking' ? 'bg-blue-500/10 text-blue-400' :
              availabilityStatus === 'available' ? 'bg-green-500/10 text-green-400' :
              'bg-red-500/10 text-red-400'
            }`}>
              {availabilityStatus === 'checking' && <Loader2 className="w-4 h-4 animate-spin" />}
              {availabilityStatus === 'available' && <CheckCircle className="w-4 h-4" />}
              {availabilityStatus === 'unavailable' && <AlertCircle className="w-4 h-4" />}
              <span className="text-sm font-medium">
                {availabilityStatus === 'checking' ? 'Sprawdzanie dostępności...' : availabilityMessage}
              </span>
            </div>
          )}

          {/* Divider */}
          <div className="border-t border-border my-4" />

          {/* Cost Summary */}
          <div className="flex items-center justify-between">
            <span className="text-text-secondary">Szacunkowy koszt:</span>
            <span className="text-2xl font-bold text-gold">
              {costSummary ? formatPrice(costSummary.total) : '— zł'}
            </span>
          </div>

          {/* CTA Button */}
          <Button
            variant="primary"
            size="lg"
            className="w-full mt-4"
            rightIcon={<ArrowRight className="w-5 h-5" />}
            onClick={handleReservation}
          >
            Przejdź do rezerwacji
          </Button>
        </div>
      </Card>
    </motion.div>
  );
}
