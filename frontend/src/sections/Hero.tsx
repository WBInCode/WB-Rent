import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowRight, PackageCheck, ShieldCheck, Sparkles, Truck } from 'lucide-react';
import { CostWidget } from '@/components/CostWidget';
import { HeroSpotlight } from '@/components/HeroSpotlight';
import { products } from '@/data/products';
import { staggerContainerVariants, staggerItemVariants } from '@/lib/motion';

const trustPoints = [
  { icon: Truck, value: '30 km', label: 'Dowozimy pod adres' },
  { icon: ShieldCheck, value: 'Umowa online', label: 'Podpis bez wizyty' },
  { icon: PackageCheck, value: '11 urządzeń', label: 'Sprzęt Kärcher' },
];

const SPOTLIGHT_IDS = ['puzzi-10-1', 'nt-30-1', 'ozonmed-pro-10g', 'sg-4-4', 'af-100-h13'];

export function Hero() {
  const spotlightProducts = useMemo(
    () =>
      SPOTLIGHT_IDS.map((id) => products.find((product) => product.id === id)).filter(
        (product): product is (typeof products)[number] => Boolean(product)
      ),
    []
  );

  return (
    <section id="start" className="relative overflow-hidden">
      <div className="relative max-w-7xl mx-auto px-4 md:px-6 lg:px-8 pt-24 pb-16 md:pt-32 md:pb-24">
        <div className="grid grid-cols-1 lg:grid-cols-[1.05fr_0.95fr] gap-12 lg:gap-16 items-start">
          {/* Left Column - Content */}
          <motion.div
            variants={staggerContainerVariants}
            initial="hidden"
            animate="visible"
            className="space-y-7"
          >
            <motion.div variants={staggerItemVariants}>
              <span className="inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold/[0.07] px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-gold">
                <Sparkles className="w-3 h-3" aria-hidden="true" />
                Wynajem sprzętu · Rzeszów
              </span>
            </motion.div>

            <motion.div variants={staggerItemVariants} className="space-y-5">
              <h1 className="font-bold leading-[0.95] tracking-tight text-[clamp(2.5rem,6vw,4.4rem)]">
                <span className="block text-text-primary">Sprzęt czyszczący</span>
                <span className="block text-gradient-gold">bez kupowania</span>
              </h1>
              <p className="max-w-xl text-lg leading-relaxed text-text-secondary">
                Odkurzacze piorące Kärcher, ozonatory i parownice na dobę lub weekend.
                Sprawdzasz cenę, rezerwujesz online, a sprzęt dowozimy pod wskazany adres.
              </p>
            </motion.div>

            <motion.div variants={staggerItemVariants} className="flex flex-wrap gap-3">
              <Link
                to="/rezerwacja"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-[--radius-sm] bg-gradient-to-r from-gold via-gold-light to-gold bg-[length:200%_100%] bg-left px-7 font-semibold text-bg-primary shadow-md transition-[background-position,box-shadow] duration-300 hover:bg-right hover:shadow-[0_0_28px_var(--color-gold-glow)]"
              >
                Zarezerwuj sprzęt
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </Link>
              <Link
                to="/sprzet"
                className="inline-flex h-12 items-center justify-center rounded-[--radius-sm] border border-border bg-bg-card px-7 font-medium text-text-primary transition-colors hover:border-border-hover hover:bg-bg-card-hover"
              >
                Przeglądaj cennik
              </Link>
            </motion.div>

            {/* Trust strip - concrete promises instead of vague numbers */}
            <motion.ul
              variants={staggerItemVariants}
              className="grid grid-cols-1 sm:grid-cols-3 gap-px overflow-hidden rounded-[--radius-sm] border border-border bg-border max-w-2xl"
            >
              {trustPoints.map(({ icon: Icon, value, label }) => (
                <li key={value} className="flex items-center gap-3 bg-bg-card px-4 py-3.5">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-gold/25 bg-gold/[0.08] text-gold">
                    <Icon className="w-4 h-4" aria-hidden="true" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-text-primary">{value}</span>
                    <span className="block text-xs text-text-muted">{label}</span>
                  </span>
                </li>
              ))}
            </motion.ul>

            {/* Equipment spotlight */}
            <motion.div variants={staggerItemVariants} className="max-w-2xl">
              <HeroSpotlight products={spotlightProducts} />
            </motion.div>
          </motion.div>

          {/* Right Column - Calculator */}
          <div className="lg:sticky lg:top-28">
            <CostWidget />
          </div>
        </div>
      </div>
    </section>
  );
}
