import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, FileText, Scale, Clock, Shield, AlertTriangle, Phone, Mail } from 'lucide-react';
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

export function RegulaminPage() {
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
              <li className="text-gold font-medium">Regulamin</li>
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
                <FileText className="w-7 h-7 text-bg-primary" />
              </div>
              <div>
                <h1 className="text-3xl md:text-4xl font-bold text-text-primary">
                  Regulamin Wypożyczalni
                </h1>
                <p className="text-text-muted mt-1">Obowiązuje od 1 stycznia 2026</p>
              </div>
            </div>
            
            <Card variant="glass" className="p-4">
              <p className="text-text-secondary text-sm">
                Niniejszy regulamin określa zasady wypożyczania sprzętu czyszczącego i ozonatorów 
                przez firmę {COMPANY_INFO.name} z siedzibą w Rzeszowie.
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
            {/* §1 Postanowienia ogólne */}
            <motion.section variants={staggerItemVariants}>
              <Card variant="default" className="p-6 md:p-8">
                <div className="flex items-center gap-3 mb-4">
                  <Scale className="w-6 h-6 text-gold" />
                  <h2 className="text-xl font-bold text-text-primary">§1. Postanowienia ogólne</h2>
                </div>
                <ol className="space-y-3 text-text-secondary list-decimal list-inside">
                  <li>Wypożyczalnia WB-Rent jest prowadzona przez {COMPANY_INFO.name}, NIP: {COMPANY_INFO.nip}, REGON: {COMPANY_INFO.regon}, KRS: {COMPANY_INFO.krs}.</li>
                  <li>Siedziba wypożyczalni znajduje się pod adresem: {COMPANY_INFO.address}.</li>
                  <li>Wypożyczalnia oferuje wynajem profesjonalnego sprzętu czyszczącego, odkurzaczy piorących, ozonatorów oraz urządzeń pokrewnych.</li>
                  <li>Regulamin określa warunki wynajmu sprzętu pomiędzy Wypożyczalnią a Najemcą.</li>
                  <li>Złożenie rezerwacji jest równoznaczne z akceptacją niniejszego regulaminu.</li>
                </ol>
              </Card>
            </motion.section>

            {/* §2 Rezerwacja i wynajem */}
            <motion.section variants={staggerItemVariants}>
              <Card variant="default" className="p-6 md:p-8">
                <div className="flex items-center gap-3 mb-4">
                  <Clock className="w-6 h-6 text-gold" />
                  <h2 className="text-xl font-bold text-text-primary">§2. Rezerwacja i wynajem</h2>
                </div>
                <ol className="space-y-3 text-text-secondary list-decimal list-inside">
                  <li>Rezerwacji można dokonać poprzez formularz na stronie internetowej, telefonicznie lub osobiście w siedzibie firmy.</li>
                  <li>Rezerwacja wymaga podania danych kontaktowych: imienia, nazwiska, numeru telefonu oraz adresu e-mail.</li>
                  <li>Potwierdzenie rezerwacji następuje drogą mailową lub telefoniczną.</li>
                  <li>Wypożyczalnia zastrzega sobie prawo do odmowy realizacji rezerwacji bez podania przyczyny.</li>
                  <li>Doba wypożyczenia liczona jest od godziny odbioru sprzętu do tej samej godziny dnia następnego.</li>
                  <li>Minimalna doba wypożyczenia wynosi 24 godziny.</li>
                  <li>Wypożyczenie weekendowe obejmuje okres od piątku (godz. 15:00) do poniedziałku (godz. 9:00).</li>
                </ol>
              </Card>
            </motion.section>

            {/* §3 Odbiór i zwrot */}
            <motion.section variants={staggerItemVariants}>
              <Card variant="default" className="p-6 md:p-8">
                <div className="flex items-center gap-3 mb-4">
                  <Clock className="w-6 h-6 text-gold" />
                  <h2 className="text-xl font-bold text-text-primary">§3. Odbiór i zwrot sprzętu</h2>
                </div>
                <ol className="space-y-3 text-text-secondary list-decimal list-inside">
                  <li>Odbiór sprzętu możliwy jest osobiście w siedzibie wypożyczalni lub poprzez dostawę pod wskazany adres (w promieniu do 30 km od Rzeszowa).</li>
                  <li>Przy odbiorze Najemca zobowiązany jest do okazania dokumentu tożsamości.</li>
                  <li>Najemca potwierdza odbiór sprawnego sprzętu podpisem na protokole zdawczo-odbiorczym.</li>
                  <li>Zwrot sprzętu następuje w miejscu jego odbioru, chyba że strony ustalą inaczej.</li>
                  <li>Sprzęt należy zwrócić w stanie niepogorszonym, czysty i suchy.</li>
                  <li>Opóźnienie w zwrocie sprzętu skutkuje naliczeniem dodatkowej opłaty za każdą rozpoczętą dobę.</li>
                  <li>W przypadku odbioru w weekend naliczana jest dodatkowa opłata zgodna z cennikiem.</li>
                </ol>
              </Card>
            </motion.section>

            {/* §4 Opłaty i kaucja */}
            <motion.section variants={staggerItemVariants}>
              <Card variant="default" className="p-6 md:p-8">
                <div className="flex items-center gap-3 mb-4">
                  <Scale className="w-6 h-6 text-gold" />
                  <h2 className="text-xl font-bold text-text-primary">§4. Opłaty i kaucja</h2>
                </div>
                <ol className="space-y-3 text-text-secondary list-decimal list-inside">
                  <li>Ceny wynajmu są podane w cenniku dostępnym na stronie internetowej i obowiązują w momencie składania rezerwacji.</li>
                  <li>Opłata za wynajem pobierana jest z góry przy odbiorze sprzętu.</li>
                  <li>Akceptowane formy płatności: gotówka, przelew bankowy, BLIK.</li>
                  <li>Wypożyczalnia może wymagać wpłaty kaucji zwrotnej w wysokości określonej dla danego urządzenia.</li>
                  <li>Kaucja podlega zwrotowi po sprawdzeniu stanu technicznego sprzętu przy jego zwrocie.</li>
                  <li>Z kaucji mogą zostać potrącone koszty naprawy uszkodzeń lub czyszczenia sprzętu.</li>
                  <li>Dostawa i odbiór sprzętu są dodatkowo płatne zgodnie z cennikiem (20 zł w jedną stronę w promieniu 30 km).</li>
                </ol>
              </Card>
            </motion.section>

            {/* §5 Obowiązki Najemcy */}
            <motion.section variants={staggerItemVariants}>
              <Card variant="default" className="p-6 md:p-8">
                <div className="flex items-center gap-3 mb-4">
                  <Shield className="w-6 h-6 text-gold" />
                  <h2 className="text-xl font-bold text-text-primary">§5. Obowiązki Najemcy</h2>
                </div>
                <ol className="space-y-3 text-text-secondary list-decimal list-inside">
                  <li>Najemca zobowiązuje się do używania sprzętu zgodnie z jego przeznaczeniem i instrukcją obsługi.</li>
                  <li>Zabrania się dokonywania jakichkolwiek napraw lub modyfikacji sprzętu.</li>
                  <li>Najemca ponosi pełną odpowiedzialność za sprzęt od momentu odbioru do momentu zwrotu.</li>
                  <li>W przypadku awarii lub uszkodzenia sprzętu, Najemca zobowiązany jest niezwłocznie poinformować Wypożyczalnię.</li>
                  <li>Zabrania się podnajmowania lub użyczania sprzętu osobom trzecim.</li>
                  <li>Najemca zobowiązany jest stosować wyłącznie środki czyszczące zalecane przez producenta lub dostarczone przez Wypożyczalnię.</li>
                  <li>Po zakończeniu użytkowania należy opróżnić zbiorniki i oczyścić urządzenie.</li>
                </ol>
              </Card>
            </motion.section>

            {/* §6 Odpowiedzialność */}
            <motion.section variants={staggerItemVariants}>
              <Card variant="default" className="p-6 md:p-8">
                <div className="flex items-center gap-3 mb-4">
                  <AlertTriangle className="w-6 h-6 text-gold" />
                  <h2 className="text-xl font-bold text-text-primary">§6. Odpowiedzialność za szkody</h2>
                </div>
                <ol className="space-y-3 text-text-secondary list-decimal list-inside">
                  <li>Najemca ponosi pełną odpowiedzialność materialną za uszkodzenie, zniszczenie lub utratę wypożyczonego sprzętu.</li>
                  <li>W przypadku uszkodzenia sprzętu, Najemca zobowiązany jest do pokrycia kosztów naprawy.</li>
                  <li>W przypadku całkowitego zniszczenia lub utraty sprzętu, Najemca zobowiązany jest do zapłaty równowartości urządzenia według aktualnej ceny rynkowej.</li>
                  <li>Wypożyczalnia nie ponosi odpowiedzialności za szkody powstałe w wyniku nieprawidłowego użytkowania sprzętu przez Najemcę.</li>
                  <li>Wypożyczalnia nie odpowiada za szkody wyrządzone przez Najemcę osobom trzecim podczas korzystania ze sprzętu.</li>
                </ol>
              </Card>
            </motion.section>

            {/* §7 Anulowanie rezerwacji */}
            <motion.section variants={staggerItemVariants}>
              <Card variant="default" className="p-6 md:p-8">
                <div className="flex items-center gap-3 mb-4">
                  <Clock className="w-6 h-6 text-gold" />
                  <h2 className="text-xl font-bold text-text-primary">§7. Anulowanie rezerwacji</h2>
                </div>
                <ol className="space-y-3 text-text-secondary list-decimal list-inside">
                  <li>Najemca może anulować rezerwację bezpłatnie do 24 godzin przed planowanym terminem odbioru.</li>
                  <li>Anulowanie rezerwacji w terminie krótszym niż 24 godziny może skutkować obciążeniem opłatą w wysokości 50% wartości pierwszej doby wynajmu.</li>
                  <li>Nieodebranie sprzętu w umówionym terminie bez wcześniejszego powiadomienia traktowane jest jako anulowanie rezerwacji.</li>
                  <li>Wypożyczalnia zastrzega sobie prawo do anulowania rezerwacji w przypadku niedostępności sprzętu z przyczyn losowych, informując o tym Najemcę niezwłocznie.</li>
                </ol>
              </Card>
            </motion.section>

            {/* §8 Reklamacje */}
            <motion.section variants={staggerItemVariants}>
              <Card variant="default" className="p-6 md:p-8">
                <div className="flex items-center gap-3 mb-4">
                  <Shield className="w-6 h-6 text-gold" />
                  <h2 className="text-xl font-bold text-text-primary">§8. Reklamacje</h2>
                </div>
                <ol className="space-y-3 text-text-secondary list-decimal list-inside">
                  <li>Reklamacje dotyczące świadczonych usług można składać mailowo, telefonicznie lub pisemnie.</li>
                  <li>Reklamacja powinna zawierać: dane kontaktowe, opis problemu, datę wypożyczenia oraz oczekiwany sposób rozwiązania.</li>
                  <li>Wypożyczalnia rozpatruje reklamacje w terminie 14 dni roboczych od daty ich otrzymania.</li>
                  <li>O wyniku rozpatrzenia reklamacji Najemca zostanie poinformowany drogą mailową lub telefoniczną.</li>
                </ol>
              </Card>
            </motion.section>

            {/* §9 Postanowienia końcowe */}
            <motion.section variants={staggerItemVariants}>
              <Card variant="default" className="p-6 md:p-8">
                <div className="flex items-center gap-3 mb-4">
                  <FileText className="w-6 h-6 text-gold" />
                  <h2 className="text-xl font-bold text-text-primary">§9. Postanowienia końcowe</h2>
                </div>
                <ol className="space-y-3 text-text-secondary list-decimal list-inside">
                  <li>W sprawach nieuregulowanych niniejszym regulaminem zastosowanie mają przepisy Kodeksu Cywilnego.</li>
                  <li>Wszelkie spory będą rozstrzygane przez sąd właściwy dla siedziby Wypożyczalni.</li>
                  <li>Wypożyczalnia zastrzega sobie prawo do zmiany regulaminu. Zmiany wchodzą w życie z dniem publikacji na stronie internetowej.</li>
                  <li>Regulamin obowiązuje od dnia 1 stycznia 2026 roku.</li>
                </ol>
              </Card>
            </motion.section>

            {/* Contact */}
            <motion.section variants={staggerItemVariants}>
              <Card variant="glow" className="p-6 md:p-8">
                <h2 className="text-xl font-bold text-gold mb-4">Kontakt w sprawie regulaminu</h2>
                <p className="text-text-secondary mb-6">
                  W przypadku pytań dotyczących regulaminu prosimy o kontakt:
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
