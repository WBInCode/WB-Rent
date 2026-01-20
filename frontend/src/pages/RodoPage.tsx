import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Shield, UserCheck, Eye, Lock, FileText, Phone, Mail } from 'lucide-react';
import { Button, Card } from '@/components/ui';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/sections/Footer';
import { revealVariants, staggerContainerVariants, staggerItemVariants } from '@/lib/motion';

const COMPANY_INFO = {
  name: 'WB Partners Sp. z o.o.',
  address: 'ul. Słowackiego 24/11, 35-060 Rzeszów',
  nip: '5170455185',
  phone: '570 038 828',
  email: 'kontakt@wb-rent.pl',
};

export function RodoPage() {
  // Scroll to top on page load
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="min-h-screen bg-bg-primary">
      <Navbar />
      
      <main className="pt-24 pb-20">
        <div className="max-w-4xl mx-auto px-4 md:px-6 lg:px-8">
          {/* Breadcrumb */}
          <motion.nav 
            variants={revealVariants}
            initial="hidden"
            animate="visible"
            className="mb-8"
          >
            <ol className="flex items-center gap-2 text-sm text-text-muted">
              <li>
                <Link to="/" className="hover:text-gold transition-colors">Strona główna</Link>
              </li>
              <li>/</li>
              <li className="text-gold font-medium">RODO</li>
            </ol>
          </motion.nav>

          {/* Header */}
          <motion.div
            variants={revealVariants}
            initial="hidden"
            animate="visible"
            className="mb-12"
          >
            <div className="flex items-center gap-4 mb-6">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-gold to-gold-dark flex items-center justify-center">
                <Shield className="w-7 h-7 text-bg-primary" />
              </div>
              <div>
                <h1 className="text-3xl md:text-4xl font-bold text-text-primary">
                  Informacja RODO
                </h1>
                <p className="text-text-muted mt-1">Rozporządzenie o Ochronie Danych Osobowych</p>
              </div>
            </div>
            
            <Card variant="glass" className="p-4">
              <p className="text-text-secondary text-sm">
                Zgodnie z art. 13 ust. 1 i 2 Rozporządzenia Parlamentu Europejskiego i Rady (UE) 2016/679 
                z dnia 27 kwietnia 2016 r. w sprawie ochrony osób fizycznych w związku z przetwarzaniem 
                danych osobowych (RODO), informujemy o zasadach przetwarzania Państwa danych osobowych.
              </p>
            </Card>
          </motion.div>

          {/* Content */}
          <motion.div
            variants={staggerContainerVariants}
            initial="hidden"
            animate="visible"
            className="space-y-8"
          >
            {/* Administrator */}
            <motion.section variants={staggerItemVariants}>
              <Card variant="default" className="p-6 md:p-8">
                <div className="flex items-center gap-3 mb-4">
                  <UserCheck className="w-6 h-6 text-gold" />
                  <h2 className="text-xl font-bold text-text-primary">Administrator danych osobowych</h2>
                </div>
                <p className="text-text-secondary mb-4">
                  Administratorem Państwa danych osobowych jest:
                </p>
                <div className="p-4 rounded-lg bg-bg-primary/50 border border-border-primary">
                  <p className="font-semibold text-text-primary">{COMPANY_INFO.name}</p>
                  <p className="text-text-secondary text-sm mt-1">{COMPANY_INFO.address}</p>
                  <p className="text-text-secondary text-sm">NIP: {COMPANY_INFO.nip}</p>
                  <p className="text-text-secondary text-sm mt-2">
                    Kontakt: <a href={`mailto:${COMPANY_INFO.email}`} className="text-gold hover:underline">{COMPANY_INFO.email}</a>
                  </p>
                </div>
              </Card>
            </motion.section>

            {/* Cel przetwarzania */}
            <motion.section variants={staggerItemVariants}>
              <Card variant="default" className="p-6 md:p-8">
                <div className="flex items-center gap-3 mb-4">
                  <Eye className="w-6 h-6 text-gold" />
                  <h2 className="text-xl font-bold text-text-primary">Cel przetwarzania danych</h2>
                </div>
                <p className="text-text-secondary mb-4">
                  Państwa dane osobowe przetwarzane są w celu:
                </p>
                <ul className="space-y-3 text-text-secondary">
                  <li className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full bg-gold/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-gold text-xs font-bold">1</span>
                    </span>
                    <span>Realizacji usługi wypożyczenia sprzętu (art. 6 ust. 1 lit. b RODO)</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full bg-gold/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-gold text-xs font-bold">2</span>
                    </span>
                    <span>Obsługi zapytań kontaktowych (art. 6 ust. 1 lit. f RODO)</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full bg-gold/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-gold text-xs font-bold">3</span>
                    </span>
                    <span>Wypełnienia obowiązków podatkowych i księgowych (art. 6 ust. 1 lit. c RODO)</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full bg-gold/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-gold text-xs font-bold">4</span>
                    </span>
                    <span>Dochodzenia lub obrony przed roszczeniami (art. 6 ust. 1 lit. f RODO)</span>
                  </li>
                </ul>
              </Card>
            </motion.section>

            {/* Prawa użytkownika */}
            <motion.section variants={staggerItemVariants} id="prawa-uzytkownikow">
              <Card variant="glow" className="p-6 md:p-8">
                <div className="flex items-center gap-3 mb-4">
                  <Lock className="w-6 h-6 text-gold" />
                  <h2 className="text-xl font-bold text-text-primary">Państwa prawa</h2>
                </div>
                <p className="text-text-secondary mb-4">
                  Na podstawie RODO przysługują Państwu następujące prawa:
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {[
                    { title: 'Prawo dostępu', desc: 'Uzyskanie informacji o przetwarzanych danych' },
                    { title: 'Prawo do sprostowania', desc: 'Poprawienie nieprawidłowych danych' },
                    { title: 'Prawo do usunięcia', desc: '"Prawo do bycia zapomnianym"' },
                    { title: 'Prawo do ograniczenia', desc: 'Ograniczenie operacji na danych' },
                    { title: 'Prawo do przenoszenia', desc: 'Otrzymanie danych w formacie elektronicznym' },
                    { title: 'Prawo do sprzeciwu', desc: 'Sprzeciw wobec przetwarzania danych' },
                  ].map((item, index) => (
                    <div key={index} className="flex items-start gap-3 p-3 rounded-lg bg-bg-primary/50">
                      <div className="w-6 h-6 rounded-full bg-gold/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-gold text-xs font-bold">✓</span>
                      </div>
                      <div>
                        <p className="font-medium text-text-primary">{item.title}</p>
                        <p className="text-sm text-text-muted">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </motion.section>

            {/* Okres przechowywania */}
            <motion.section variants={staggerItemVariants}>
              <Card variant="default" className="p-6 md:p-8">
                <div className="flex items-center gap-3 mb-4">
                  <FileText className="w-6 h-6 text-gold" />
                  <h2 className="text-xl font-bold text-text-primary">Okres przechowywania danych</h2>
                </div>
                <ul className="space-y-3 text-text-secondary list-disc list-inside">
                  <li>Dane związane z rezerwacjami: <strong>5 lat</strong> (wymogi podatkowe)</li>
                  <li>Dane z formularza kontaktowego: <strong>2 lata</strong> od ostatniego kontaktu</li>
                  <li>Dane przetwarzane na podstawie zgody: <strong>do momentu wycofania zgody</strong></li>
                </ul>
              </Card>
            </motion.section>

            {/* Skarga do UODO */}
            <motion.section variants={staggerItemVariants}>
              <Card variant="default" className="p-6 md:p-8">
                <div className="flex items-center gap-3 mb-4">
                  <Shield className="w-6 h-6 text-gold" />
                  <h2 className="text-xl font-bold text-text-primary">Prawo do skargi</h2>
                </div>
                <p className="text-text-secondary">
                  Jeśli uważają Państwo, że przetwarzanie danych osobowych narusza przepisy RODO, 
                  mają Państwo prawo wniesienia skargi do organu nadzorczego:
                </p>
                <div className="mt-4 p-4 rounded-lg bg-bg-primary/50 border border-border-primary">
                  <p className="font-semibold text-text-primary">Prezes Urzędu Ochrony Danych Osobowych</p>
                  <p className="text-text-secondary text-sm mt-1">ul. Stawki 2, 00-193 Warszawa</p>
                  <p className="text-text-secondary text-sm">
                    <a href="https://uodo.gov.pl" target="_blank" rel="noopener noreferrer" className="text-gold hover:underline">
                      www.uodo.gov.pl
                    </a>
                  </p>
                </div>
              </Card>
            </motion.section>

            {/* Contact */}
            <motion.section variants={staggerItemVariants}>
              <Card variant="glass" className="p-6 md:p-8">
                <h2 className="text-xl font-bold text-gold mb-4">Kontakt w sprawie danych osobowych</h2>
                <p className="text-text-secondary mb-6">
                  W sprawach związanych z ochroną danych osobowych prosimy o kontakt:
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <a 
                    href={`tel:+48${COMPANY_INFO.phone.replace(/\s/g, '')}`}
                    className="flex items-center gap-3 p-4 rounded-xl bg-bg-primary/50 hover:bg-bg-primary/70 transition-colors group"
                  >
                    <div className="w-10 h-10 rounded-full bg-gold/20 flex items-center justify-center group-hover:bg-gold/30 transition-colors">
                      <Phone className="w-5 h-5 text-gold" />
                    </div>
                    <div>
                      <p className="text-sm text-text-muted">Telefon</p>
                      <p className="font-medium text-text-primary">{COMPANY_INFO.phone}</p>
                    </div>
                  </a>
                  <a 
                    href={`mailto:${COMPANY_INFO.email}`}
                    className="flex items-center gap-3 p-4 rounded-xl bg-bg-primary/50 hover:bg-bg-primary/70 transition-colors group"
                  >
                    <div className="w-10 h-10 rounded-full bg-gold/20 flex items-center justify-center group-hover:bg-gold/30 transition-colors">
                      <Mail className="w-5 h-5 text-gold" />
                    </div>
                    <div>
                      <p className="text-sm text-text-muted">Email</p>
                      <p className="font-medium text-text-primary">{COMPANY_INFO.email}</p>
                    </div>
                  </a>
                </div>
              </Card>
            </motion.section>

            {/* Links */}
            <motion.section variants={staggerItemVariants}>
              <div className="flex flex-wrap gap-4 justify-center">
                <Link to="/regulamin">
                  <Button variant="secondary">
                    <FileText className="w-4 h-4 mr-2" />
                    Regulamin
                  </Button>
                </Link>
                <Link to="/polityka-prywatnosci">
                  <Button variant="secondary">
                    <Shield className="w-4 h-4 mr-2" />
                    Polityka prywatności
                  </Button>
                </Link>
              </div>
            </motion.section>
          </motion.div>

          {/* Back button */}
          <motion.div
            variants={revealVariants}
            initial="hidden"
            animate="visible"
            className="mt-12 text-center"
          >
            <Link to="/">
              <Button variant="secondary" size="lg">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Wróć do strony głównej
              </Button>
            </Link>
          </motion.div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
