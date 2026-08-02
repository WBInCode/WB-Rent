import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';
import { getProductImages, type Product } from '@/data/products';
import { formatPrice } from '@/lib/utils';

interface EquipmentCarouselProps {
  products: Product[];
  availability?: Record<string, boolean>;
}

/**
 * Scroll-snap carousel. Native scrolling keeps touch, trackpad and keyboard
 * behaviour intact; the arrows only nudge the same scroll container.
 */
export function EquipmentCarousel({ products, availability }: EquipmentCarouselProps) {
  const trackRef = useRef<HTMLUListElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateArrows = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    const maxScroll = track.scrollWidth - track.clientWidth;
    setCanScrollLeft(track.scrollLeft > 8);
    setCanScrollRight(track.scrollLeft < maxScroll - 8);
  }, []);

  useEffect(() => {
    updateArrows();
    const track = trackRef.current;
    if (!track) return;
    track.addEventListener('scroll', updateArrows, { passive: true });
    window.addEventListener('resize', updateArrows);
    return () => {
      track.removeEventListener('scroll', updateArrows);
      window.removeEventListener('resize', updateArrows);
    };
  }, [updateArrows, products.length]);

  const scrollByCard = (direction: 1 | -1) => {
    const track = trackRef.current;
    if (!track) return;
    const card = track.querySelector(':scope > li');
    const step = card ? card.getBoundingClientRect().width + 20 : track.clientWidth * 0.8;
    track.scrollBy({ left: step * direction, behavior: 'smooth' });
  };

  if (products.length === 0) return null;

  return (
    <div className="relative">
      <div className="mb-4 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => scrollByCard(-1)}
          disabled={!canScrollLeft}
          aria-label="Poprzedni sprzęt"
          className="flex h-10 w-10 items-center justify-center rounded-[--radius-sm] border border-border bg-bg-card text-text-secondary transition-colors hover:border-gold/40 hover:text-gold disabled:opacity-35 disabled:hover:border-border disabled:hover:text-text-secondary"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => scrollByCard(1)}
          disabled={!canScrollRight}
          aria-label="Następny sprzęt"
          className="flex h-10 w-10 items-center justify-center rounded-[--radius-sm] border border-border bg-bg-card text-text-secondary transition-colors hover:border-gold/40 hover:text-gold disabled:opacity-35 disabled:hover:border-border disabled:hover:text-text-secondary"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <ul
        ref={trackRef}
        className="carousel-track flex snap-x snap-mandatory gap-5 overflow-x-auto pb-2"
        aria-label="Sprzęt dostępny do wynajęcia"
      >
        {products.map((product) => {
          const isAvailable = availability
            ? availability[product.id] !== false
            : product.available;

          return (
            <li
              key={product.id}
              className="w-[268px] shrink-0 snap-start sm:w-[300px]"
            >
              <Link
                to={`/produkt/${product.id}`}
                className="group flex h-full flex-col overflow-hidden rounded-[--radius-sm] border border-border bg-bg-card transition-colors hover:border-gold/35"
              >
                <div className="relative aspect-[4/3] overflow-hidden bg-white">
                  <img
                    src={getProductImages(product)[0]}
                    alt={product.name}
                    loading="lazy"
                    width={300}
                    height={225}
                    className="h-full w-full object-contain p-4 transition-transform duration-500 group-hover:scale-[1.04]"
                  />
                  <span
                    className={`absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold backdrop-blur-sm ${
                      isAvailable
                        ? 'bg-emerald-500/90 text-white'
                        : 'bg-neutral-900/80 text-neutral-200'
                    }`}
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-current" />
                    {isAvailable ? 'Dostępny' : 'Wypożyczony'}
                  </span>
                </div>

                <div className="flex flex-1 flex-col p-5">
                  <h3 className="line-clamp-2 text-base font-semibold text-text-primary transition-colors group-hover:text-gold">
                    {product.name}
                  </h3>

                  {product.features.length > 0 && (
                    <ul className="mt-3 flex flex-wrap gap-1.5">
                      {product.features.slice(0, 2).map((feature) => (
                        <li
                          key={feature}
                          className="rounded-md border border-border bg-surface-soft px-2 py-0.5 text-[11px] text-text-muted"
                        >
                          {feature}
                        </li>
                      ))}
                    </ul>
                  )}

                  <div className="mt-auto flex items-end justify-between pt-5">
                    <span>
                      <span className="block text-[11px] text-text-muted">od</span>
                      <span className="text-xl font-bold text-gold">
                        {formatPrice(product.pricePerDay)}
                      </span>
                      <span className="text-[11px] text-text-muted"> / doba</span>
                    </span>
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-text-secondary transition-colors group-hover:text-gold">
                      Szczegóły
                      <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                    </span>
                  </div>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
