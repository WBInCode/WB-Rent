import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Calendar, MapPin, Truck, ArrowRight, Calculator } from 'lucide-react';
import { Card, Select, Input, Toggle, Button } from '@/components/ui';
import { categories, getProductsByCategory, calculateRentalCost, type Product } from '@/data/products';
import { formatPrice, calculateDays } from '@/lib/utils';
import { revealVariants } from '@/lib/motion';

export function CostWidget() {
  const [categoryId, setCategoryId] = useState('');
  const [productId, setProductId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [city, setCity] = useState('');
  const [delivery, setDelivery] = useState(false);

  // Get products for selected category
  const availableProducts = useMemo(() => {
    if (!categoryId) return [];
    return getProductsByCategory(categoryId).filter((p) => p.available);
  }, [categoryId]);

  // Calculate cost
  const costSummary = useMemo(() => {
    if (!productId || !startDate || !endDate) return null;
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) {
      return null;
    }

    const days = calculateDays(start, end);
    return calculateRentalCost(productId, days, delivery);
  }, [productId, startDate, endDate, delivery]);

  // Reset product when category changes
  const handleCategoryChange = (value: string) => {
    setCategoryId(value);
    setProductId('');
  };

  const handleReservation = () => {
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
