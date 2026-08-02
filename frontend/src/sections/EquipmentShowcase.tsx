import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { EquipmentCarousel } from '@/components/EquipmentCarousel';
import { products } from '@/data/products';
import { revealVariants } from '@/lib/motion';
import { getProductsAvailability } from '@/services/api';

/** Equipment showcase on the landing page - a taste of the full catalogue. */
export function EquipmentShowcase() {
  const [availability, setAvailability] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let cancelled = false;
    getProductsAvailability()
      .then((response) => {
        if (!cancelled && response.success && response.data) {
          setAvailability(response.data.availability);
        }
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  return (
    <section className="relative py-20 md:py-28">
      <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8">
        <motion.div
          variants={revealVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-100px' }}
          className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between"
        >
          <div className="max-w-2xl">
            <span className="section-kicker">Ekspozycja sprzętu</span>
            <h2 className="section-title">Sprawdzony sprzęt, gotowy do pracy</h2>
            <p className="section-copy">
              Każde urządzenie jest serwisowane po zwrocie i kompletne w chwili wydania.
              Przewiń, żeby zobaczyć, co możesz wynająć już dziś.
            </p>
          </div>
          <Link
            to="/sprzet"
            className="group inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-[--radius-sm] border border-border bg-bg-card px-5 font-medium text-text-primary transition-colors hover:border-gold/40 hover:text-gold"
          >
            Pełny cennik
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </motion.div>

        <motion.div
          variants={revealVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-80px' }}
          className="mt-10"
        >
          <EquipmentCarousel products={products} availability={availability} />
        </motion.div>
      </div>
    </section>
  );
}
