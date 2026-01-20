import { motion } from 'framer-motion';
import { Sparkles, Clock, BadgeCheck, Headphones, Zap } from 'lucide-react';
import { Button, Badge } from '@/components/ui';
import { CostWidget } from '@/components/CostWidget';
import { staggerContainerVariants, staggerItemVariants } from '@/lib/motion';

const features = [
  { icon: Clock, label: 'Szybkie terminy' },
  { icon: BadgeCheck, label: 'Jasne ceny' },
  { icon: Headphones, label: 'Wsparcie 24/7' },
  { icon: Zap, label: 'Nowoczesna flota' },
];

const stats = [
  { value: '24/7', label: 'Wsparcie' },
  { value: '30km', label: 'Zasięg dostaw' },
  { value: '~1h', label: 'Czas odpowiedzi' },
];

export function Hero() {
  const handleScrollToProducts = () => {
    document.getElementById('produkty')?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleScrollToReservation = () => {
    document.getElementById('rezerwacja')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section id="start" className="relative overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-bg-primary via-bg-primary to-bg-secondary pointer-events-none" />
      
      {/* Subtle gold glow in top right */}
      <div 
        className="absolute -top-40 -right-40 w-96 h-96 rounded-full opacity-20 blur-3xl pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(245, 158, 11, 0.3) 0%, transparent 70%)' }}
      />

      <div className="relative max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-12 md:py-20 lg:py-28">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left Column - Content */}
          <motion.div
            variants={staggerContainerVariants}
            initial="hidden"
            animate="visible"
            className="space-y-8"
          >
            {/* Badge */}
            <motion.div variants={staggerItemVariants}>
              <Badge variant="gold" icon={<Sparkles className="w-3 h-3" />}>
                Profesjonalny wynajem sprzętu
              </Badge>
            </motion.div>

            {/* Headline */}
            <motion.div variants={staggerItemVariants} className="space-y-4">
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight">
                <span className="text-text-primary">Sprzęt czyszczący</span>
                <br />
                <span className="text-gradient-gold">na wyciągnięcie ręki</span>
              </h1>
              <p className="text-lg md:text-xl text-text-secondary max-w-lg">
                Wynajmij profesjonalne ozonatory i sprzęt czyszczący w najlepszych cenach. 
                Sprawdź dostępność, zarezerwuj online i ciesz się czystością bez zakupu drogiego sprzętu.
              </p>
            </motion.div>

            {/* Stats */}
            <motion.div 
              variants={staggerItemVariants}
              className="flex flex-wrap gap-6 md:gap-10"
            >
              {stats.map((stat) => (
                <div key={stat.label} className="text-center">
                  <div className="text-3xl md:text-4xl font-bold text-gold">{stat.value}</div>
                  <div className="text-sm text-text-muted">{stat.label}</div>
                </div>
              ))}
            </motion.div>

            {/* CTA Buttons */}
            <motion.div 
              variants={staggerItemVariants}
              className="flex flex-wrap gap-4"
            >
              <Button 
                variant="primary" 
                size="lg"
                onClick={handleScrollToReservation}
              >
                Rezerwuj online
              </Button>
              <Button 
                variant="secondary" 
                size="lg"
                onClick={handleScrollToProducts}
              >
                Zobacz ceny
              </Button>
            </motion.div>

            {/* Feature badges */}
            <motion.div 
              variants={staggerItemVariants}
              className="flex flex-wrap gap-3"
            >
              {features.map((feature) => (
                <div 
                  key={feature.label}
                  className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-border text-sm text-text-secondary"
                >
                  <feature.icon className="w-4 h-4 text-gold" />
                  {feature.label}
                </div>
              ))}
            </motion.div>
          </motion.div>

          {/* Right Column - Widget */}
          <div className="lg:pl-8">
            <CostWidget />
          </div>
        </div>
      </div>

      {/* Bottom fade */}
      <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-bg-secondary to-transparent pointer-events-none" />
    </section>
  );
}
