import { motion } from 'framer-motion';
import { Search, CalendarCheck, Truck, Sparkles } from 'lucide-react';
import { staggerContainerVariants, staggerItemVariants, revealVariants } from '@/lib/motion';

interface Step {
  number: string;
  title: string;
  description: string;
  icon: React.ElementType;
}

const steps: Step[] = [
  {
    number: '01',
    title: 'Wybierz sprzęt',
    description: 'Przeglądaj naszą ofertę ozonatorów i sprzętu czyszczącego. Sprawdź dostępność i ceny.',
    icon: Search,
  },
  {
    number: '02',
    title: 'Zarezerwuj termin',
    description: 'Wybierz daty wynajmu i wypełnij prosty formularz rezerwacji online.',
    icon: CalendarCheck,
  },
  {
    number: '03',
    title: 'Odbierz lub zamów dostawę',
    description: 'Odbierz sprzęt osobiście lub skorzystaj z naszej usługi dostawy pod wskazany adres.',
    icon: Truck,
  },
  {
    number: '04',
    title: 'Ciesz się czystością',
    description: 'Korzystaj z profesjonalnego sprzętu i ciesz się efektami. Po zakończeniu zwróć urządzenie.',
    icon: Sparkles,
  },
];

export function HowItWorks() {
  return (
    <section id="jak-to-dziala" className="relative overflow-hidden py-20 md:py-28 lg:py-32 bg-bg-secondary">
      {/* Background decorations */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Connecting line */}
        <div className="hidden lg:block absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3/4 h-0.5 bg-gradient-to-r from-transparent via-border to-transparent" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 md:px-6 lg:px-8">
        {/* Section Header */}
        <motion.div
          variants={revealVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-100px' }}
          className="text-center mb-16 md:mb-20"
        >
          <span className="inline-block text-gold text-sm font-medium tracking-wider uppercase mb-4">
            Prosty proces
          </span>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-text-primary mb-4">
            Jak to działa?
          </h2>
          <p className="text-lg text-text-secondary max-w-2xl mx-auto">
            Wynajem sprzętu w WB-Rent to prosty, 4-krokowy proces. 
            Od wyboru urządzenia do zwrotu - wszystko online.
          </p>
        </motion.div>

        {/* Steps Grid */}
        <motion.div
          variants={staggerContainerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-100px' }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-6"
        >
          {steps.map((step, index) => {
            const Icon = step.icon;
            const isLast = index === steps.length - 1;

            return (
              <motion.div
                key={step.number}
                variants={staggerItemVariants}
                className="relative group"
              >
                {/* Connector arrow (hidden on mobile and for last item) */}
                {!isLast && (
                  <div className="hidden lg:block absolute top-12 -right-3 w-6 h-6 text-gold/30 z-10">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M5 12h14M12 5l7 7-7 7" />
                    </svg>
                  </div>
                )}

                {/* Card */}
                <div className="relative h-full p-6 md:p-8 rounded-2xl bg-bg-card border border-border hover:border-gold/30 transition-all duration-300 group-hover:shadow-gold">
                  {/* Step number */}
                  <div className="absolute -top-4 left-6 px-3 py-1 rounded-full bg-gold text-bg-primary text-sm font-bold">
                    {step.number}
                  </div>

                  {/* Icon */}
                  <div className="mt-4 mb-6">
                    <div className="w-14 h-14 rounded-xl bg-gold/10 flex items-center justify-center group-hover:bg-gold/20 transition-colors duration-300">
                      <Icon className="w-7 h-7 text-gold" />
                    </div>
                  </div>

                  {/* Content */}
                  <h3 className="text-xl font-semibold text-text-primary mb-3 group-hover:text-gold transition-colors duration-300">
                    {step.title}
                  </h3>
                  <p className="text-text-secondary text-sm leading-relaxed">
                    {step.description}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </motion.div>

        {/* Bottom CTA */}
        <motion.div
          variants={revealVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-50px' }}
          className="text-center mt-16"
        >
          <p className="text-text-muted mb-6">
            Gotowy, aby rozpocząć?
          </p>
          <a
            href="#rezerwacja"
            onClick={(e) => {
              e.preventDefault();
              document.getElementById('rezerwacja')?.scrollIntoView({ behavior: 'smooth' });
            }}
            className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-gold text-bg-primary font-semibold hover:bg-gold-light transition-colors duration-300"
          >
            Zarezerwuj teraz
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </a>
        </motion.div>
      </div>
    </section>
  );
}
