import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { MessageCircle } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { ContactPanel } from '@/components/ContactPanel';
import { Footer } from '@/sections/Footer';
import { revealVariants } from '@/lib/motion';

export function ContactPage() {
  useEffect(() => {
    window.scrollTo(0, 0);
    const previousTitle = document.title;
    document.title = 'Kontakt | WB-Rent Rzeszów';
    return () => {
      document.title = previousTitle;
    };
  }, []);

  return (
    <div className="min-h-screen bg-transparent relative">
      <Navbar />
      <main className="relative z-10 pt-28 md:pt-36 pb-24">
        <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8">
          <motion.header
            variants={revealVariants}
            initial="hidden"
            animate="visible"
            className="max-w-3xl mb-12 md:mb-16"
          >
            <div className="inline-flex items-center gap-2 text-gold text-sm font-medium uppercase tracking-wider mb-4">
              <MessageCircle className="w-4 h-4" /> Kontakt
            </div>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-text-primary">
              Porozmawiajmy o Twoim wynajmie
            </h1>
            <p className="text-lg md:text-xl text-text-secondary mt-5 max-w-2xl">
              Doradzimy urządzenie, sprawdzimy termin i odpowiemy na pytania dotyczące odbioru,
              dostawy oraz obsługi sprzętu.
            </p>
          </motion.header>

          <ContactPanel />
        </div>
      </main>
      <Footer />
    </div>
  );
}

export default ContactPage;
