import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ChevronDown, 
  Mail, 
  Phone, 
  MapPin, 
  Clock, 
  Send,
  User,
  MessageSquare,
  Loader2,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { Card, Input, Button, Textarea } from '@/components/ui';
import { staggerContainerVariants, staggerItemVariants, revealVariants } from '@/lib/motion';

// FAQ Data
const faqItems = [
  {
    question: 'Jak mogę zarezerwować sprzęt?',
    answer: 'Rezerwacji można dokonać poprzez formularz na naszej stronie, telefonicznie lub mailowo. Po złożeniu rezerwacji skontaktujemy się z Tobą w ciągu 24 godzin w celu potwierdzenia.',
  },
  {
    question: 'Jakie są formy płatności?',
    answer: 'Akceptujemy płatności gotówką przy odbiorze, przelewem bankowym oraz kartą płatniczą. W przypadku firm możliwa jest również płatność na fakturę z odroczonym terminem.',
  },
  {
    question: 'Czy mogę odebrać sprzęt osobiście?',
    answer: 'Tak, odbiór osobisty jest możliwy w naszym punkcie. Prosimy o wcześniejsze umówienie się na konkretną godzinę. Oferujemy również dostawę pod wskazany adres.',
  },
  {
    question: 'Co jeśli sprzęt ulegnie awarii podczas wynajmu?',
    answer: 'W przypadku awarii prosimy o niezwłoczny kontakt. Zapewniamy wymianę urządzenia na sprawne lub proporcjonalny zwrot kosztów. Nie ponosimy odpowiedzialności za awarie spowodowane niewłaściwym użytkowaniem.',
  },
  {
    question: 'Czy jest wymagana kaucja?',
    answer: 'Tak, przy niektórych urządzeniach pobieramy kaucję zwrotną. Jej wysokość zależy od wartości sprzętu. Kaucja jest zwracana po oddaniu sprzętu w stanie nienaruszonym.',
  },
  {
    question: 'Jakie są godziny odbioru i zwrotu?',
    answer: 'Standardowe godziny to poniedziałek-piątek 8:00-18:00, sobota 9:00-14:00. Odbiór w niedzielę lub poza godzinami pracy jest możliwy za dodatkową opłatą.',
  },
  {
    question: 'Czy oferujecie wynajem długoterminowy?',
    answer: 'Tak, oferujemy atrakcyjne rabaty przy wynajmie długoterminowym (powyżej 7 dni). Skontaktuj się z nami, aby uzyskać indywidualną wycenę.',
  },
  {
    question: 'Jakie dokumenty są potrzebne do wynajmu?',
    answer: 'Wymagamy dowodu osobistego lub innego dokumentu tożsamości. W przypadku firm - dodatkowo NIP i dane firmy. Podpisujemy umowę najmu określającą warunki.',
  },
];

// Contact info
const contactInfo = [
  {
    icon: Phone,
    label: 'Telefon',
    value: '+48 123 456 789',
    href: 'tel:+48123456789',
  },
  {
    icon: Mail,
    label: 'Email',
    value: 'kontakt@wb-rent.pl',
    href: 'mailto:kontakt@wb-rent.pl',
  },
  {
    icon: MapPin,
    label: 'Adres',
    value: 'ul. Przykładowa 123, Warszawa',
    href: 'https://maps.google.com',
  },
  {
    icon: Clock,
    label: 'Godziny',
    value: 'Pon-Pt: 8-18, Sob: 9-14',
    href: null,
  },
];

type FormStatus = 'idle' | 'loading' | 'success' | 'error';

interface FAQItemProps {
  question: string;
  answer: string;
  isOpen: boolean;
  onToggle: () => void;
}

function FAQItem({ question, answer, isOpen, onToggle }: FAQItemProps) {
  return (
    <div className="border-b border-border last:border-b-0">
      <button
        onClick={onToggle}
        className="w-full py-5 flex items-center justify-between text-left group"
      >
        <span className="text-text-primary font-medium pr-4 group-hover:text-gold transition-colors">
          {question}
        </span>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="shrink-0"
        >
          <ChevronDown className={`w-5 h-5 ${isOpen ? 'text-gold' : 'text-text-muted'}`} />
        </motion.div>
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <p className="pb-5 text-text-secondary leading-relaxed">
              {answer}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function FAQContact() {
  const [openFAQ, setOpenFAQ] = useState<number | null>(0);
  const [formStatus, setFormStatus] = useState<FormStatus>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  
  // Contact form state
  const [contactForm, setContactForm] = useState({
    name: '',
    email: '',
    subject: '',
    message: '',
    honeypot: '', // Anti-spam
  });

  const handleFAQToggle = (index: number) => {
    setOpenFAQ(openFAQ === index ? null : index);
  };

  const updateContactField = (field: string, value: string) => {
    setContactForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Honeypot check
    if (contactForm.honeypot) {
      return; // Bot detected
    }

    // Basic validation
    if (!contactForm.name || !contactForm.email || !contactForm.message) {
      setErrorMessage('Wypełnij wszystkie wymagane pola');
      setFormStatus('error');
      return;
    }

    setFormStatus('loading');
    setErrorMessage('');

    try {
      // TODO: Send to backend API
      await new Promise((resolve) => setTimeout(resolve, 1500));
      
      setFormStatus('success');
      setContactForm({
        name: '',
        email: '',
        subject: '',
        message: '',
        honeypot: '',
      });
      
      setTimeout(() => setFormStatus('idle'), 5000);
    } catch {
      setFormStatus('error');
      setErrorMessage('Wystąpił błąd. Spróbuj ponownie później.');
    }
  };

  return (
    <section id="faq" className="relative overflow-hidden py-20 md:py-28 lg:py-32 bg-bg-secondary">
      {/* Background decoration */}
      <div 
        className="absolute bottom-0 left-0 w-96 h-96 rounded-full opacity-10 blur-3xl pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(184, 151, 42, 0.3) 0%, transparent 70%)' }}
      />

      <div className="relative max-w-7xl mx-auto px-4 md:px-6 lg:px-8">
        {/* Section Header */}
        <motion.div
          variants={revealVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-100px' }}
          className="text-center mb-12 md:mb-16"
        >
          <span className="inline-block text-gold text-sm font-medium tracking-wider uppercase mb-4">
            Pomoc i kontakt
          </span>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-text-primary mb-4">
            Masz pytania?
          </h2>
          <p className="text-lg text-text-secondary max-w-2xl mx-auto">
            Znajdź odpowiedzi na najczęściej zadawane pytania lub skontaktuj się z nami bezpośrednio.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16">
          {/* FAQ Column */}
          <motion.div
            variants={staggerContainerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-50px' }}
          >
            <motion.div variants={staggerItemVariants}>
              <h3 className="text-xl font-semibold text-text-primary mb-6">
                Często zadawane pytania
              </h3>
              <Card variant="glass" padding="none" className="overflow-hidden">
                <div className="px-6">
                  {faqItems.map((item, index) => (
                    <FAQItem
                      key={index}
                      question={item.question}
                      answer={item.answer}
                      isOpen={openFAQ === index}
                      onToggle={() => handleFAQToggle(index)}
                    />
                  ))}
                </div>
              </Card>
            </motion.div>
          </motion.div>

          {/* Contact Column */}
          <motion.div
            variants={staggerContainerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-50px' }}
            className="space-y-8"
          >
            {/* Contact Info */}
            <motion.div variants={staggerItemVariants}>
              <h3 className="text-xl font-semibold text-text-primary mb-6">
                Dane kontaktowe
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {contactInfo.map((info) => {
                  const Icon = info.icon;
                  const content = (
                    <div className="flex items-start gap-3 p-4 rounded-xl bg-bg-card border border-border hover:border-gold/30 transition-colors">
                      <div className="w-10 h-10 rounded-lg bg-gold/10 flex items-center justify-center shrink-0">
                        <Icon className="w-5 h-5 text-gold" />
                      </div>
                      <div>
                        <p className="text-xs text-text-muted uppercase tracking-wider">{info.label}</p>
                        <p className="text-text-primary font-medium">{info.value}</p>
                      </div>
                    </div>
                  );

                  return info.href ? (
                    <a key={info.label} href={info.href} className="block">
                      {content}
                    </a>
                  ) : (
                    <div key={info.label}>{content}</div>
                  );
                })}
              </div>
            </motion.div>

            {/* Contact Form */}
            <motion.div variants={staggerItemVariants}>
              <h3 className="text-xl font-semibold text-text-primary mb-6">
                Napisz do nas
              </h3>
              
              {formStatus === 'success' ? (
                <Card variant="glow" className="p-8 text-center">
                  <CheckCircle2 className="w-12 h-12 text-success mx-auto mb-4" />
                  <h4 className="text-lg font-semibold text-text-primary mb-2">
                    Wiadomość wysłana!
                  </h4>
                  <p className="text-text-secondary text-sm">
                    Dziękujemy za kontakt. Odpowiemy najszybciej jak to możliwe.
                  </p>
                </Card>
              ) : (
                <Card variant="glass" padding="lg">
                  <form onSubmit={handleContactSubmit} className="space-y-4">
                    {/* Honeypot - hidden from users */}
                    <input
                      type="text"
                      name="honeypot"
                      value={contactForm.honeypot}
                      onChange={(e) => updateContactField('honeypot', e.target.value)}
                      className="hidden"
                      tabIndex={-1}
                      autoComplete="off"
                    />

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <Input
                        label="Imię"
                        placeholder="Jan Kowalski"
                        value={contactForm.name}
                        onChange={(e) => updateContactField('name', e.target.value)}
                        leftIcon={<User className="w-4 h-4" />}
                        required
                      />
                      <Input
                        label="Email"
                        type="email"
                        placeholder="jan@example.com"
                        value={contactForm.email}
                        onChange={(e) => updateContactField('email', e.target.value)}
                        leftIcon={<Mail className="w-4 h-4" />}
                        required
                      />
                    </div>

                    <Input
                      label="Temat (opcjonalnie)"
                      placeholder="W czym możemy pomóc?"
                      value={contactForm.subject}
                      onChange={(e) => updateContactField('subject', e.target.value)}
                      leftIcon={<MessageSquare className="w-4 h-4" />}
                    />

                    <Textarea
                      label="Wiadomość"
                      placeholder="Napisz swoją wiadomość..."
                      value={contactForm.message}
                      onChange={(e) => updateContactField('message', e.target.value)}
                      rows={4}
                      required
                    />

                    {/* Error message */}
                    {formStatus === 'error' && errorMessage && (
                      <div className="p-3 rounded-lg bg-error/10 border border-error/20 flex items-start gap-2">
                        <AlertCircle className="w-5 h-5 text-error shrink-0 mt-0.5" />
                        <p className="text-sm text-error">{errorMessage}</p>
                      </div>
                    )}

                    <Button
                      type="submit"
                      variant="primary"
                      size="lg"
                      className="w-full"
                      disabled={formStatus === 'loading'}
                    >
                      {formStatus === 'loading' ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin mr-2" />
                          Wysyłanie...
                        </>
                      ) : (
                        <>
                          <Send className="w-5 h-5 mr-2" />
                          Wyślij wiadomość
                        </>
                      )}
                    </Button>
                  </form>
                </Card>
              )}
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
