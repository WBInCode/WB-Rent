import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { 
  Rocket, 
  Sparkles, 
  TrendingUp, 
  Package, 
  Lightbulb,
  ArrowRight,
  Bell,
  Truck,
  Shield,
  X
} from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/sections/Footer';
import { Button } from '@/components/ui';
import { NewsletterSubscribe } from '@/components/NewsletterSubscribe';

const upcomingFeatures = [
  {
    icon: Package,
    title: 'Nowe kategorie sprzętu',
    description: 'Stale poszerzamy naszą ofertę o nowe urządzenia i rozwiązania.',
    status: 'W planach',
    statusColor: 'text-blue-400'
  },
  {
    icon: Truck,
    title: 'Rozszerzony zasięg dostaw',
    description: 'Pracujemy nad zwiększeniem obszaru, na którym świadczymy usługi dostawy.',
    status: 'W planach',
    statusColor: 'text-blue-400'
  },
  {
    icon: Shield,
    title: 'Program lojalnościowy',
    description: 'Przygotowujemy specjalne korzyści dla naszych stałych klientów.',
    status: 'Wkrótce',
    statusColor: 'text-purple-400'
  },
  {
    icon: Sparkles,
    title: 'Nowe funkcjonalności',
    description: 'Nieustannie ulepszamy nasze usługi i wdrażamy nowe rozwiązania.',
    status: 'W rozwoju',
    statusColor: 'text-green-400'
  }
];

const stats = [
  { value: '24/7', label: 'Wsparcie techniczne' },
  { value: '30km', label: 'Zasięg dostaw' },
  { value: '~1h', label: 'Czas odpowiedzi' },
  { value: '100%', label: 'Zaangażowania' }
];

export default function WkrotcePage() {
  const [showNewsletterModal, setShowNewsletterModal] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="min-h-screen bg-bg-primary">
      <Navbar />
      
      {/* Hero Section */}
      <section className="pt-32 pb-16 relative overflow-hidden">
        {/* Background effects */}
        <div className="absolute inset-0 bg-gradient-to-b from-gold/5 to-transparent" />
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-gold/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-gold/5 rounded-full blur-3xl" />
        
        {/* Animated Rocket Scene */}
        <div className="absolute top-20 right-10 md:right-20 lg:right-32 w-64 h-64 md:w-80 md:h-80">
          {/* Orbiting rings */}
          <motion.div
            className="absolute inset-0 border-2 border-gold/20 rounded-full"
            animate={{ rotate: 360 }}
            transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
          />
          <motion.div
            className="absolute inset-4 border border-gold/15 rounded-full"
            animate={{ rotate: -360 }}
            transition={{ duration: 25, repeat: Infinity, ease: 'linear' }}
          />
          <motion.div
            className="absolute inset-8 border border-gold/10 rounded-full"
            animate={{ rotate: 360 }}
            transition={{ duration: 30, repeat: Infinity, ease: 'linear' }}
          />
          
          {/* Orbiting icons */}
          <motion.div
            className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2"
            animate={{ rotate: 360 }}
            transition={{ duration: 15, repeat: Infinity, ease: 'linear' }}
            style={{ transformOrigin: '50% calc(50% + 128px)' }}
          >
            <div className="w-10 h-10 bg-gold/20 rounded-full flex items-center justify-center backdrop-blur-sm">
              <Package className="w-5 h-5 text-gold" />
            </div>
          </motion.div>
          
          <motion.div
            className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2"
            animate={{ rotate: 360 }}
            transition={{ duration: 18, repeat: Infinity, ease: 'linear', delay: 3 }}
            style={{ transformOrigin: '50% calc(50% + 100px)' }}
          >
            <div className="w-8 h-8 bg-purple-500/20 rounded-full flex items-center justify-center backdrop-blur-sm">
              <Sparkles className="w-4 h-4 text-purple-400" />
            </div>
          </motion.div>
          
          <motion.div
            className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2"
            animate={{ rotate: -360 }}
            transition={{ duration: 22, repeat: Infinity, ease: 'linear', delay: 6 }}
            style={{ transformOrigin: '50% calc(50% + 145px)' }}
          >
            <div className="w-9 h-9 bg-blue-500/20 rounded-full flex items-center justify-center backdrop-blur-sm">
              <TrendingUp className="w-4 h-4 text-blue-400" />
            </div>
          </motion.div>
          
          {/* Central Rocket */}
          <motion.div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
            animate={{ 
              y: [0, -10, 0],
              scale: [1, 1.02, 1]
            }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          >
            <div className="relative">
              <div className="w-20 h-20 bg-gradient-to-br from-gold/30 to-gold/10 rounded-full flex items-center justify-center backdrop-blur-md border border-gold/30">
                <Rocket className="w-10 h-10 text-gold" />
              </div>
              {/* Glow effect */}
              <div className="absolute inset-0 bg-gold/20 rounded-full blur-xl animate-pulse" />
            </div>
          </motion.div>
          
          {/* Floating particles */}
          {[...Array(6)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-2 h-2 bg-gold/40 rounded-full"
              style={{
                left: `${20 + i * 12}%`,
                top: `${30 + (i % 3) * 20}%`,
              }}
              animate={{
                y: [0, -20, 0],
                opacity: [0.3, 0.8, 0.3],
                scale: [0.8, 1.2, 0.8],
              }}
              transition={{
                duration: 2 + i * 0.5,
                repeat: Infinity,
                ease: 'easeInOut',
                delay: i * 0.3,
              }}
            />
          ))}
        </div>
        
        <div className="container mx-auto px-4 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center max-w-3xl mx-auto"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gold/10 border border-gold/30 mb-6">
              <Sparkles className="w-4 h-4 text-gold" />
              <span className="text-gold text-sm font-medium">Stale się rozwijamy</span>
            </div>
            
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-text-primary mb-6">
              Przyszłość <span className="text-gold">WB-Rent</span>
            </h1>
            
            <p className="text-lg md:text-xl text-text-secondary mb-8">
              Nieustannie pracujemy nad rozwojem naszej oferty i usług. 
              Poznaj nasze plany i bądź na bieżąco z nowościami.
            </p>

            <div className="flex flex-wrap justify-center gap-4">
              <Link to="/#rezerwacja">
                <Button size="lg" className="group">
                  Zarezerwuj teraz
                  <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
              <Button 
                variant="outline" 
                size="lg"
                onClick={() => setShowNewsletterModal(true)}
              >
                <Bell className="w-4 h-4 mr-2" />
                Powiadom mnie o nowościach
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-12 border-y border-border">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="text-center"
              >
                <div className="text-3xl md:text-4xl font-bold text-gold mb-2">{stat.value}</div>
                <div className="text-text-muted text-sm">{stat.label}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Upcoming Features */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <div className="inline-flex items-center gap-2 text-gold mb-4">
              <Rocket className="w-5 h-5" />
              <span className="text-sm font-medium uppercase tracking-wider">Nadchodzące funkcje</span>
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-text-primary mb-4">
              Co planujemy?
            </h2>
            <p className="text-text-secondary max-w-2xl mx-auto">
              Pracujemy nad nowymi rozwiązaniami, które uczynią wynajem sprzętu jeszcze prostszym i wygodniejszym.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {upcomingFeatures.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="relative p-6 rounded-2xl bg-bg-card border border-border hover:border-gold/30 transition-all group overflow-hidden"
              >
                {/* Animated glow effect */}
                <motion.div
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-gold/5 to-transparent"
                  animate={{
                    x: ['-100%', '200%'],
                  }}
                  transition={{
                    duration: 3,
                    repeat: Infinity,
                    repeatDelay: index * 2,
                    ease: 'easeInOut',
                  }}
                />
                
                <div className="relative flex items-start gap-4">
                  <motion.div 
                    className="w-12 h-12 rounded-xl bg-gold/10 flex items-center justify-center flex-shrink-0 group-hover:bg-gold/20 transition-colors"
                    animate={{
                      boxShadow: [
                        '0 0 0 0 rgba(184, 151, 42, 0)',
                        '0 0 20px 5px rgba(184, 151, 42, 0.2)',
                        '0 0 0 0 rgba(184, 151, 42, 0)',
                      ],
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      delay: index * 0.5,
                    }}
                  >
                    <feature.icon className="w-6 h-6 text-gold" />
                  </motion.div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-lg font-semibold text-text-primary">{feature.title}</h3>
                      <motion.span 
                        className={`text-xs font-medium ${feature.statusColor}`}
                        animate={{ opacity: [0.6, 1, 0.6] }}
                        transition={{ duration: 2, repeat: Infinity }}
                      >
                        {feature.status}
                      </motion.span>
                    </div>
                    <p className="text-text-secondary text-sm">{feature.description}</p>
                    
                    {/* Progress bar */}
                    <div className="mt-4 h-1 bg-bg-secondary rounded-full overflow-hidden">
                      <motion.div
                        className="h-full bg-gradient-to-r from-gold/50 to-gold rounded-full"
                        initial={{ width: '0%' }}
                        whileInView={{ width: feature.status === 'W rozwoju' ? '70%' : feature.status === 'Wkrótce' ? '45%' : '20%' }}
                        viewport={{ once: true }}
                        transition={{ duration: 1.5, delay: index * 0.2, ease: 'easeOut' }}
                      />
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Vision Section */}
      <section className="py-20 bg-gradient-to-b from-transparent via-gold/5 to-transparent">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center mb-12"
            >
              <div className="inline-flex items-center gap-2 text-gold mb-4">
                <Lightbulb className="w-5 h-5" />
                <span className="text-sm font-medium uppercase tracking-wider">Nasza wizja</span>
              </div>
              <h2 className="text-3xl md:text-4xl font-bold text-text-primary mb-6">
                Budujemy przyszłość wynajmu
              </h2>
            </motion.div>

            <div className="grid md:grid-cols-3 gap-8">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="text-center"
              >
                <div className="w-16 h-16 rounded-2xl bg-gold/10 flex items-center justify-center mx-auto mb-4">
                  <TrendingUp className="w-8 h-8 text-gold" />
                </div>
                <h3 className="text-xl font-semibold text-text-primary mb-2">Ciągły rozwój</h3>
                <p className="text-text-secondary text-sm">
                  Regularnie poszerzamy ofertę o nowe produkty i kategorie sprzętu.
                </p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.1 }}
                className="text-center"
              >
                <div className="w-16 h-16 rounded-2xl bg-gold/10 flex items-center justify-center mx-auto mb-4">
                  <Sparkles className="w-8 h-8 text-gold" />
                </div>
                <h3 className="text-xl font-semibold text-text-primary mb-2">Jakość usług</h3>
                <p className="text-text-secondary text-sm">
                  Stawiamy na najwyższą jakość obsługi i zadowolenie klienta.
                </p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.2 }}
                className="text-center"
              >
                <div className="w-16 h-16 rounded-2xl bg-gold/10 flex items-center justify-center mx-auto mb-4">
                  <Rocket className="w-8 h-8 text-gold" />
                </div>
                <h3 className="text-xl font-semibold text-text-primary mb-2">Innowacje</h3>
                <p className="text-text-secondary text-sm">
                  Wdrażamy nowoczesne rozwiązania dla Twojej wygody.
                </p>
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="max-w-3xl mx-auto text-center p-8 md:p-12 rounded-3xl bg-gradient-to-br from-gold/20 to-gold/5 border border-gold/30"
          >
            <h2 className="text-2xl md:text-3xl font-bold text-text-primary mb-4">
              Masz pomysł lub sugestię?
            </h2>
            <p className="text-text-secondary mb-8">
              Chętnie wysłuchamy Twoich propozycji. Razem tworzymy lepszą usługę wynajmu sprzętu w Rzeszowie.
            </p>
            <Link to="/#faq">
              <Button size="lg" className="group">
                Skontaktuj się z nami
                <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
          </motion.div>
        </div>
      </section>

      <Footer />

      {/* Newsletter Modal */}
      <AnimatePresence>
        {showNewsletterModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setShowNewsletterModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md relative"
            >
              <Button
                variant="ghost"
                size="sm"
                className="absolute -top-12 right-0 text-white hover:text-gold"
                onClick={() => setShowNewsletterModal(false)}
              >
                <X className="w-6 h-6" />
              </Button>
              
              <NewsletterSubscribe variant="card" />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
