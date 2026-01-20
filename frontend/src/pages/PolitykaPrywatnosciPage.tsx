import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Shield, Database, Eye, Lock, UserCheck, Clock, Globe, Phone, Mail } from 'lucide-react';
import { Button, Card } from '@/components/ui';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/sections/Footer';
import { revealVariants, staggerContainerVariants, staggerItemVariants } from '@/lib/motion';

const COMPANY_INFO = {
  name: 'WB Partners Sp. z o.o.',
  address: 'ul. Słowackiego 24/11, 35-060 Rzeszów',
  nip: '5170455185',
  regon: '540735769',
  krs: '0001151642',
  phone: '570 038 828',
  email: 'kontakt@wb-rent.pl',
};

export function PolitykaPrywatnosciPage() {
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
              <li className="text-gold font-medium">Polityka prywatności</li>
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
                  Polityka Prywatności
                </h1>
                <p className="text-text-muted mt-1">Obowiązuje od 1 stycznia 2026</p>
              </div>
            </div>
            
            <Card variant="glass" className="p-4">
              <p className="text-text-secondary text-sm">
                Niniejsza Polityka Prywatności określa zasady przetwarzania i ochrony danych osobowych 
                przekazanych przez Użytkowników w związku z korzystaniem z usług wypożyczalni WB-Rent 
                prowadzonej przez {COMPANY_INFO.name}.
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
            {/* §1 Administrator danych */}
            <motion.section variants={staggerItemVariants}>
              <Card variant="default" className="p-6 md:p-8">
                <div className="flex items-center gap-3 mb-4">
                  <UserCheck className="w-6 h-6 text-gold" />
                  <h2 className="text-xl font-bold text-text-primary">§1. Administrator danych osobowych</h2>
                </div>
                <ol className="space-y-3 text-text-secondary list-decimal list-inside">
                  <li>Administratorem danych osobowych jest {COMPANY_INFO.name}, z siedzibą pod adresem: {COMPANY_INFO.address}, NIP: {COMPANY_INFO.nip}, REGON: {COMPANY_INFO.regon}, KRS: {COMPANY_INFO.krs}.</li>
                  <li>Kontakt z Administratorem możliwy jest pod adresem e-mail: {COMPANY_INFO.email} lub telefonicznie: {COMPANY_INFO.phone}.</li>
                  <li>Administrator dokłada szczególnej staranności w celu ochrony interesów osób, których dane dotyczą.</li>
                  <li>Dane osobowe są przetwarzane zgodnie z Rozporządzeniem Parlamentu Europejskiego i Rady (UE) 2016/679 z dnia 27 kwietnia 2016 r. (RODO).</li>
                </ol>
              </Card>
            </motion.section>

            {/* §2 Zakres zbieranych danych */}
            <motion.section variants={staggerItemVariants}>
              <Card variant="default" className="p-6 md:p-8">
                <div className="flex items-center gap-3 mb-4">
                  <Database className="w-6 h-6 text-gold" />
                  <h2 className="text-xl font-bold text-text-primary">§2. Zakres zbieranych danych</h2>
                </div>
                <div className="space-y-4 text-text-secondary">
                  <p>W ramach świadczonych usług zbieramy następujące dane osobowe:</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 rounded-lg bg-bg-primary/50">
                      <h4 className="font-semibold text-text-primary mb-2">Formularz rezerwacji:</h4>
                      <ul className="space-y-1 text-sm list-disc list-inside">
                        <li>Imię i nazwisko</li>
                        <li>Adres e-mail</li>
                        <li>Numer telefonu</li>
                        <li>Adres dostawy (opcjonalnie)</li>
                        <li>Nazwa firmy (opcjonalnie)</li>
                        <li>NIP firmy (opcjonalnie)</li>
                      </ul>
                    </div>
                    <div className="p-4 rounded-lg bg-bg-primary/50">
                      <h4 className="font-semibold text-text-primary mb-2">Formularz kontaktowy:</h4>
                      <ul className="space-y-1 text-sm list-disc list-inside">
                        <li>Imię</li>
                        <li>Adres e-mail</li>
                        <li>Temat wiadomości (opcjonalnie)</li>
                        <li>Treść wiadomości</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </Card>
            </motion.section>

            {/* §3 Cel przetwarzania */}
            <motion.section variants={staggerItemVariants}>
              <Card variant="default" className="p-6 md:p-8">
                <div className="flex items-center gap-3 mb-4">
                  <Eye className="w-6 h-6 text-gold" />
                  <h2 className="text-xl font-bold text-text-primary">§3. Cel i podstawa przetwarzania danych</h2>
                </div>
                <div className="space-y-4 text-text-secondary">
                  <p>Dane osobowe przetwarzane są w następujących celach:</p>
                  <ol className="space-y-3 list-decimal list-inside">
                    <li><strong>Realizacja umowy wypożyczenia</strong> (art. 6 ust. 1 lit. b RODO) – przetwarzanie jest niezbędne do wykonania umowy, której stroną jest osoba, której dane dotyczą.</li>
                    <li><strong>Obsługa zapytań</strong> (art. 6 ust. 1 lit. f RODO) – prawnie uzasadniony interes Administratora polegający na udzielaniu odpowiedzi na pytania.</li>
                    <li><strong>Wystawianie faktur</strong> (art. 6 ust. 1 lit. c RODO) – wypełnienie obowiązku prawnego ciążącego na Administratorze.</li>
                    <li><strong>Dochodzenie roszczeń</strong> (art. 6 ust. 1 lit. f RODO) – prawnie uzasadniony interes Administratora.</li>
                    <li><strong>Marketing bezpośredni</strong> (art. 6 ust. 1 lit. a RODO) – wyłącznie na podstawie dobrowolnej zgody.</li>
                  </ol>
                </div>
              </Card>
            </motion.section>

            {/* §4 Okres przechowywania */}
            <motion.section variants={staggerItemVariants}>
              <Card variant="default" className="p-6 md:p-8">
                <div className="flex items-center gap-3 mb-4">
                  <Clock className="w-6 h-6 text-gold" />
                  <h2 className="text-xl font-bold text-text-primary">§4. Okres przechowywania danych</h2>
                </div>
                <ol className="space-y-3 text-text-secondary list-decimal list-inside">
                  <li>Dane związane z realizacją rezerwacji przechowywane są przez okres 5 lat od zakończenia roku kalendarzowego, w którym dokonano transakcji (wymogi podatkowe).</li>
                  <li>Dane z formularza kontaktowego przechowywane są przez okres 2 lat od ostatniego kontaktu.</li>
                  <li>Dane przetwarzane na podstawie zgody – do momentu jej wycofania.</li>
                  <li>Dane do celów marketingowych – do momentu wniesienia sprzeciwu.</li>
                  <li>Po upływie okresów przechowywania dane są trwale usuwane lub anonimizowane.</li>
                </ol>
              </Card>
            </motion.section>

            {/* §5 Prawa użytkowników */}
            <motion.section variants={staggerItemVariants}>
              <Card variant="default" className="p-6 md:p-8">
                <div className="flex items-center gap-3 mb-4">
                  <UserCheck className="w-6 h-6 text-gold" />
                  <h2 className="text-xl font-bold text-text-primary">§5. Prawa osób, których dane dotyczą</h2>
                </div>
                <div className="space-y-4 text-text-secondary">
                  <p>Każda osoba, której dane są przetwarzane, ma prawo do:</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="flex items-start gap-2 p-3 rounded-lg bg-bg-primary/50">
                      <div className="w-6 h-6 rounded-full bg-gold/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-gold text-xs font-bold">1</span>
                      </div>
                      <div>
                        <p className="font-medium text-text-primary">Dostęp do danych</p>
                        <p className="text-sm">Uzyskanie informacji o przetwarzanych danych</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2 p-3 rounded-lg bg-bg-primary/50">
                      <div className="w-6 h-6 rounded-full bg-gold/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-gold text-xs font-bold">2</span>
                      </div>
                      <div>
                        <p className="font-medium text-text-primary">Sprostowanie danych</p>
                        <p className="text-sm">Poprawienie nieprawidłowych danych</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2 p-3 rounded-lg bg-bg-primary/50">
                      <div className="w-6 h-6 rounded-full bg-gold/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-gold text-xs font-bold">3</span>
                      </div>
                      <div>
                        <p className="font-medium text-text-primary">Usunięcie danych</p>
                        <p className="text-sm">"Prawo do bycia zapomnianym"</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2 p-3 rounded-lg bg-bg-primary/50">
                      <div className="w-6 h-6 rounded-full bg-gold/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-gold text-xs font-bold">4</span>
                      </div>
                      <div>
                        <p className="font-medium text-text-primary">Ograniczenie przetwarzania</p>
                        <p className="text-sm">Żądanie ograniczenia operacji na danych</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2 p-3 rounded-lg bg-bg-primary/50">
                      <div className="w-6 h-6 rounded-full bg-gold/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-gold text-xs font-bold">5</span>
                      </div>
                      <div>
                        <p className="font-medium text-text-primary">Przenoszenie danych</p>
                        <p className="text-sm">Otrzymanie danych w formacie do odczytu maszynowego</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2 p-3 rounded-lg bg-bg-primary/50">
                      <div className="w-6 h-6 rounded-full bg-gold/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-gold text-xs font-bold">6</span>
                      </div>
                      <div>
                        <p className="font-medium text-text-primary">Sprzeciw</p>
                        <p className="text-sm">Wniesienie sprzeciwu wobec przetwarzania</p>
                      </div>
                    </div>
                  </div>
                  <p className="text-sm mt-4">
                    W celu realizacji powyższych praw prosimy o kontakt na adres: <strong>{COMPANY_INFO.email}</strong>
                  </p>
                </div>
              </Card>
            </motion.section>

            {/* §6 Bezpieczeństwo */}
            <motion.section variants={staggerItemVariants}>
              <Card variant="default" className="p-6 md:p-8">
                <div className="flex items-center gap-3 mb-4">
                  <Lock className="w-6 h-6 text-gold" />
                  <h2 className="text-xl font-bold text-text-primary">§6. Bezpieczeństwo danych</h2>
                </div>
                <ol className="space-y-3 text-text-secondary list-decimal list-inside">
                  <li>Administrator stosuje odpowiednie środki techniczne i organizacyjne zapewniające ochronę danych osobowych.</li>
                  <li>Dane przesyłane są za pomocą protokołu SSL (szyfrowane połączenie HTTPS).</li>
                  <li>Dostęp do danych mają wyłącznie upoważnione osoby, zobowiązane do zachowania poufności.</li>
                  <li>Dane przechowywane są na zabezpieczonych serwerach z regularnie aktualizowanym oprogramowaniem.</li>
                  <li>Regularnie przeprowadzane są kopie zapasowe danych.</li>
                </ol>
              </Card>
            </motion.section>

            {/* §7 Odbiorcy danych */}
            <motion.section variants={staggerItemVariants}>
              <Card variant="default" className="p-6 md:p-8">
                <div className="flex items-center gap-3 mb-4">
                  <Globe className="w-6 h-6 text-gold" />
                  <h2 className="text-xl font-bold text-text-primary">§7. Odbiorcy danych</h2>
                </div>
                <ol className="space-y-3 text-text-secondary list-decimal list-inside">
                  <li>Dane osobowe mogą być przekazywane podmiotom świadczącym usługi na rzecz Administratora (np. hosting, obsługa płatności, księgowość).</li>
                  <li>Dane mogą być udostępniane organom państwowym na podstawie przepisów prawa.</li>
                  <li>Administrator nie przekazuje danych do państw trzecich (poza EOG).</li>
                  <li>Dane nie są sprzedawane ani udostępniane podmiotom trzecim w celach marketingowych bez zgody użytkownika.</li>
                </ol>
              </Card>
            </motion.section>

            {/* §8 Pliki cookies */}
            <motion.section variants={staggerItemVariants}>
              <Card variant="default" className="p-6 md:p-8">
                <div className="flex items-center gap-3 mb-4">
                  <Database className="w-6 h-6 text-gold" />
                  <h2 className="text-xl font-bold text-text-primary">§8. Pliki cookies</h2>
                </div>
                <ol className="space-y-3 text-text-secondary list-decimal list-inside">
                  <li>Strona internetowa wykorzystuje pliki cookies w celu zapewnienia prawidłowego działania oraz analizy ruchu.</li>
                  <li>Cookies to niewielkie pliki tekstowe zapisywane na urządzeniu użytkownika.</li>
                  <li>Stosowane rodzaje cookies:
                    <ul className="mt-2 ml-6 space-y-1 list-disc">
                      <li><strong>Niezbędne</strong> – wymagane do działania strony</li>
                      <li><strong>Analityczne</strong> – pomagają zrozumieć sposób korzystania ze strony</li>
                      <li><strong>Funkcjonalne</strong> – zapamiętują preferencje użytkownika</li>
                    </ul>
                  </li>
                  <li>Użytkownik może zarządzać cookies poprzez ustawienia przeglądarki internetowej.</li>
                  <li>Wyłączenie cookies może wpłynąć na funkcjonalność strony.</li>
                </ol>
              </Card>
            </motion.section>

            {/* §9 Postanowienia końcowe */}
            <motion.section variants={staggerItemVariants}>
              <Card variant="default" className="p-6 md:p-8">
                <div className="flex items-center gap-3 mb-4">
                  <Shield className="w-6 h-6 text-gold" />
                  <h2 className="text-xl font-bold text-text-primary">§9. Postanowienia końcowe</h2>
                </div>
                <ol className="space-y-3 text-text-secondary list-decimal list-inside">
                  <li>Administrator zastrzega sobie prawo do zmiany Polityki Prywatności. Zmiany wchodzą w życie z dniem publikacji na stronie.</li>
                  <li>W przypadku pytań lub wątpliwości dotyczących ochrony danych osobowych prosimy o kontakt.</li>
                  <li>Użytkownik ma prawo wniesienia skargi do organu nadzorczego – Prezesa Urzędu Ochrony Danych Osobowych (ul. Stawki 2, 00-193 Warszawa).</li>
                  <li>Niniejsza Polityka Prywatności obowiązuje od dnia 1 stycznia 2026 roku.</li>
                </ol>
              </Card>
            </motion.section>

            {/* Contact */}
            <motion.section variants={staggerItemVariants}>
              <Card variant="glow" className="p-6 md:p-8">
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
