import { motion } from 'framer-motion';
import { Link } from 'react-router';
import { ArrowRight, CalendarCheck, FileSignature, Truck } from 'lucide-react';
import { revealVariants } from '@/lib/motion';

const steps = [
  {
    icon: CalendarCheck,
    title: 'Wybierasz termin',
    copy: 'Sprawdzasz dostępność w kalendarzu i rezerwujesz sprzęt online w kilka minut.',
  },
  {
    icon: FileSignature,
    title: 'Podpisujesz umowę',
    copy: 'Umowę podpisujesz elektronicznie — bez drukowania i bez wizyty w biurze.',
  },
  {
    icon: Truck,
    title: 'Odbierasz lub dowozimy',
    copy: 'Sprzęt odbierasz w Rzeszowie albo dowozimy go pod wskazany adres do 30 km.',
  },
];

/** Closing section of the landing page - routes visitors into the subpages. */
export function HomeHighlights() {
  return (
    <section className="relative py-20 md:py-28">
      <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8">
        <motion.div
          variants={revealVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-100px' }}
          className="max-w-2xl"
        >
          <span className="section-kicker">Jak to działa</span>
          <h2 className="section-title">Trzy kroki do wynajmu</h2>
          <p className="section-copy">
            Cały proces prowadzimy online. Nie musisz nigdzie dzwonić ani czekać na potwierdzenie.
          </p>
        </motion.div>

        <ol className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-5">
          {steps.map(({ icon: Icon, title, copy }, index) => (
            <motion.li
              key={title}
              variants={revealVariants}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-80px' }}
              transition={{ delay: index * 0.08 }}
              className="group relative rounded-[--radius-sm] border border-border bg-bg-card p-6 transition-colors hover:border-gold/30"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-lg border border-gold/25 bg-gold/[0.08] text-gold">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <p className="mt-4 text-[11px] font-bold uppercase tracking-[0.14em] text-text-muted">
                Krok {index + 1}
              </p>
              <h3 className="mt-1 text-lg font-semibold text-text-primary">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-text-secondary">{copy}</p>
            </motion.li>
          ))}
        </ol>

        <motion.div
          variants={revealVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-80px' }}
          className="mt-12 overflow-hidden rounded-[--radius-sm] border border-gold/25 bg-gradient-to-br from-gold/[0.09] via-transparent to-transparent p-8 md:p-10"
        >
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="max-w-xl">
              <h3 className="text-2xl font-bold text-text-primary">
                Sprawdź cenę dla swojego terminu
              </h3>
              <p className="mt-2 text-text-secondary">
                Pełny cennik dobowy i pakiety weekendowe znajdziesz w zakładce ze sprzętem.
                Rezerwacja zajmuje kilka minut.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                to="/rezerwacja"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-[--radius-sm] bg-gradient-to-r from-gold via-gold-light to-gold bg-[length:200%_100%] bg-left px-7 font-semibold text-bg-primary shadow-md transition-[background-position,box-shadow] duration-300 hover:bg-right hover:shadow-[0_0_28px_var(--color-gold-glow)]"
              >
                Rezerwuj online
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <Link
                to="/jak-to-dziala"
                className="inline-flex h-12 items-center justify-center rounded-[--radius-sm] border border-border bg-bg-card px-7 font-medium text-text-primary transition-colors hover:border-border-hover hover:bg-bg-card-hover"
              >
                Poznaj szczegóły
              </Link>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
