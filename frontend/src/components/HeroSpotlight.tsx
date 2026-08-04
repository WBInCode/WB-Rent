import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Link } from 'react-router';
import { ArrowRight } from 'lucide-react';
import { getProductImages, type Product } from '@/data/products';
import { formatPrice } from '@/lib/utils';
import { useReducedMotion } from '@/hooks/useReducedMotion';

interface HeroSpotlightProps {
  products: Product[];
}

const ROTATION_MS = 4500;

/** Rotating equipment spotlight - shows the fleet without a wall of images. */
export function HeroSpotlight({ products }: HeroSpotlightProps) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    if (prefersReducedMotion || paused || products.length < 2) return;
    const timer = setInterval(
      () => setIndex((current) => (current + 1) % products.length),
      ROTATION_MS
    );
    return () => clearInterval(timer);
  }, [prefersReducedMotion, paused, products.length]);

  if (products.length === 0) return null;

  const active = products[Math.min(index, products.length - 1)];

  return (
    <div
      className="rounded-[--radius-sm] border border-border bg-bg-card/70 p-4 backdrop-blur-sm"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      <div className="flex items-center gap-4">
        <div className="relative h-[76px] w-[88px] shrink-0 overflow-hidden rounded-[--radius-sm] bg-white">
          <AnimatePresence mode="wait">
            <motion.img
              key={active.id}
              src={getProductImages(active)[0]}
              alt={active.name}
              width={88}
              height={76}
              initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={prefersReducedMotion ? undefined : { opacity: 0, scale: 1.04 }}
              transition={{ duration: 0.35 }}
              className="absolute inset-0 h-full w-full object-contain p-2"
            />
          </AnimatePresence>
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-gold">
            W ofercie teraz
          </p>
          <AnimatePresence mode="wait">
            <motion.div
              key={active.id}
              initial={prefersReducedMotion ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={prefersReducedMotion ? undefined : { opacity: 0, y: -6 }}
              transition={{ duration: 0.25 }}
            >
              <p className="mt-1 truncate text-sm font-semibold text-text-primary">
                {active.name}
              </p>
              <p className="truncate text-xs text-text-muted">
                {active.features.slice(0, 2).join(' · ') || active.description}
              </p>
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="shrink-0 text-right">
          <p className="text-xl font-bold text-gold">{formatPrice(active.pricePerDay)}</p>
          <p className="text-[11px] text-text-muted">za dobę</p>
          <Link
            to={`/produkt/${active.id}`}
            className="mt-1 inline-flex items-center gap-1 text-xs text-text-secondary transition-colors hover:text-gold"
          >
            Szczegóły <ArrowRight className="h-3 w-3" aria-hidden="true" />
          </Link>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-1.5" role="tablist" aria-label="Wybierz sprzęt">
        {products.map((product, productIndex) => (
          <button
            key={product.id}
            type="button"
            role="tab"
            aria-selected={productIndex === index}
            aria-label={product.name}
            onClick={() => setIndex(productIndex)}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              productIndex === index
                ? 'w-7 bg-gold'
                : 'w-1.5 bg-border-hover hover:bg-gold/50'
            }`}
          />
        ))}
      </div>
    </div>
  );
}
