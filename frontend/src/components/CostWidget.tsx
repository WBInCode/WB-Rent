import { useState, useMemo, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { MapPin, Truck, ArrowRight, Calculator, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { Card, Select, Input, Toggle, Button } from '@/components/ui';
import { DatePicker } from '@/components/ui/DatePicker';
import { categories, getProductsByCategory, calculateRentalCost, type Product } from '@/data/products';
import { formatPrice, calculateDays } from '@/lib/utils';
import { revealVariants } from '@/lib/motion';
import { useReservationContext } from '@/context/ReservationContext';
import { checkAvailability } from '@/services/api';

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

  // Distance checking for delivery
  const [distanceStatus, setDistanceStatus] = useState<'idle' | 'checking' | 'ok' | 'too_far'>('idle');
  const [distanceMessage, setDistanceMessage] = useState<string | null>(null);

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

  // Check delivery distance when city changes
  const checkDeliveryDistance = useCallback(async (cityName: string) => {
    if (!cityName || !delivery) {
      setDistanceStatus('idle');
      setDistanceMessage(null);
      return;
    }

    setDistanceStatus('checking');
    setDistanceMessage(null);

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(cityName + ', Polska')}&limit=1`,
        { headers: { 'Accept-Language': 'pl' } }
      );
      
      if (!response.ok) throw new Error('Geocoding failed');
      
      const data = await response.json();
      
      if (data.length === 0) {
        setDistanceStatus('idle');
        setDistanceMessage(null);
        return;
      }

      const distance = calculateDistance(
        RZESZOW_COORDS.lat,
        RZESZOW_COORDS.lng,
        parseFloat(data[0].lat),
        parseFloat(data[0].lon)
      );

      if (distance > 30) {
        setDistanceStatus('too_far');
        setDistanceMessage(`Za daleko (${Math.round(distance)} km). Max 30 km od Rzeszowa.`);
      } else {
        setDistanceStatus('ok');
        setDistanceMessage(`OK (${Math.round(distance)} km)`);
      }
    } catch {
      setDistanceStatus('idle');
      setDistanceMessage(null);
    }
  }, [delivery]);

  // Debounced distance check
  useEffect(() => {
    if (!delivery || !city) {
      setDistanceStatus('idle');
      setDistanceMessage(null);
      return;
    }

    const timeoutId = setTimeout(() => {
      checkDeliveryDistance(city);
    }, 800);

    return () => clearTimeout(timeoutId);
  }, [city, delivery, checkDeliveryDistance]);

  // Reset distance when delivery is toggled off
  useEffect(() => {
    if (!delivery) {
      setDistanceStatus('idle');
      setDistanceMessage(null);
    }
  }, [delivery]);

  // Reset product when category changes
  const handleCategoryChange = (value: string) => {
    setCategoryId(value);
    setProductId('');
  };

  const handleReservation = () => {
    // Block if delivery address is too far
    if (delivery && distanceStatus === 'too_far') {
      return;
    }

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
      <Card variant="glow" className="p-6 md:p-8 overflow-visible">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-semibold text-text-primary">Sprawdź koszty</h3>
          <Calculator className="w-5 h-5 text-gold" />
        </div>

        {/* Form */}
        <div className="space-y-4 overflow-visible">
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 overflow-visible">
            <DatePicker
              label="Data rozpoczęcia"
              value={startDate}
              onChange={setStartDate}
              minDate={new Date().toISOString().split('T')[0]}
            />
            <DatePicker
              label="Data zakończenia"
              value={endDate}
              onChange={setEndDate}
              minDate={startDate || new Date().toISOString().split('T')[0]}
            />
          </div>

          {/* City */}
          <div className="space-y-2">
            <Input
              label="Miasto"
              placeholder="Np. Rzeszów"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              leftIcon={<MapPin className="w-4 h-4" />}
            />
            
            {/* Distance Status - only show when delivery is enabled */}
            {delivery && distanceStatus !== 'idle' && (
              <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
                distanceStatus === 'checking' ? 'bg-blue-500/10 text-blue-400' :
                distanceStatus === 'ok' ? 'bg-green-500/10 text-green-400' :
                'bg-red-500/10 text-red-400'
              }`}>
                {distanceStatus === 'checking' && <Loader2 className="w-3 h-3 animate-spin" />}
                {distanceStatus === 'ok' && <CheckCircle className="w-3 h-3" />}
                {distanceStatus === 'too_far' && <AlertCircle className="w-3 h-3" />}
                <span className="text-xs">{distanceStatus === 'checking' ? 'Sprawdzanie...' : distanceMessage}</span>
              </div>
            )}
          </div>

          {/* Delivery Toggle */}
          <div className="flex items-center justify-between py-2">
            <Toggle
              label="Dostawa"
              description={delivery && distanceStatus === 'too_far' ? 'Adres poza zasięgiem!' : 'Opcja z transportem (+40 zł, max 30 km)'}
              checked={delivery}
              onChange={(e) => setDelivery(e.target.checked)}
            />
            <Truck className={`w-5 h-5 ${delivery && distanceStatus === 'too_far' ? 'text-red-400' : 'text-text-muted'}`} />
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

          {/* Warning if delivery too far */}
          {delivery && distanceStatus === 'too_far' && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
              <p className="text-sm text-red-400 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                Dostawa możliwa tylko do 30 km od Rzeszowa. Wybierz odbiór osobisty lub zmień miasto.
              </p>
            </div>
          )}

          {/* CTA Button */}
          <Button
            variant="primary"
            size="lg"
            className="w-full mt-4"
            rightIcon={<ArrowRight className="w-5 h-5" />}
            onClick={handleReservation}
            disabled={delivery && distanceStatus === 'too_far'}
          >
            {delivery && distanceStatus === 'too_far' ? 'Adres poza zasięgiem' : 'Przejdź do rezerwacji'}
          </Button>
        </div>
      </Card>
    </motion.div>
  );
}
