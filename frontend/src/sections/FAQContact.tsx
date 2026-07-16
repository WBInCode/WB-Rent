import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, MessageCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button, Card } from '@/components/ui';
import { staggerContainerVariants, staggerItemVariants, revealVariants } from '@/lib/motion';

const faqItems = [
  {
    question: 'Jak mogę zarezerwować sprzęt?',
    answer: 'Rezerwacji można dokonać poprzez formularz na naszej stronie, telefonicznie lub mailowo. Po złożeniu rezerwacji skontaktujemy się z Tobą w ciągu 24 godzin w celu potwierdzenia.',
  },
  {
    question: 'Jakie są formy płatności?',
    answer: 'Akceptujemy płatności online, gotówkę przy odbiorze, przelew bankowy i BLIK — zależnie od opcji udostępnionych przy zawieraniu umowy.',
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
    answer: 'Standardowe godziny to poniedziałek-piątek 9:00-17:00 oraz sobota 9:00-15:00. Odbiór poza godzinami pracy wymaga wcześniejszego uzgodnienia.',
  },
  {
    question: 'Czy oferujecie wynajem długoterminowy?',
    answer: 'Tak, oferujemy atrakcyjne warunki przy wynajmie długoterminowym powyżej 7 dni. Skontaktuj się z nami, aby uzyskać indywidualną wycenę.',
  },
  {
    question: 'Jakie dokumenty są potrzebne do wynajmu?',
    answer: 'Wymagamy dowodu osobistego lub paszportu. W przypadku firm dodatkowo potrzebujemy NIP i danych firmy. Przed wydaniem sprzętu klient podpisuje elektroniczną umowę najmu.',
  },
];

interface FAQItemProps {
  question: string;
  answer: string;
  isOpen: boolean;
  onToggle: () => void;
  index: number;
}

function FAQItem({ question, answer, isOpen, onToggle, index }: FAQItemProps) {
  const answerId = `faq-answer-${index}`;
  const questionId = `faq-question-${index}`;

  return (
    <div className="border-b border-border last:border-b-0">
      <button
        id={questionId}
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-controls={answerId}
        className="w-full py-5 flex items-center justify-between text-left group focus-visible:outline-2 focus-visible:outline-gold focus-visible:outline-offset-2 rounded-lg"
      >
        <span className="text-text-primary font-medium pr-4 group-hover:text-gold transition-colors">
          {question}
        </span>
        <motion.div animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.2 }} className="shrink-0" aria-hidden="true">
          <ChevronDown className={`w-5 h-5 ${isOpen ? 'text-gold' : 'text-text-muted'}`} />
        </motion.div>
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            id={answerId}
            role="region"
            aria-labelledby={questionId}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <p className="pb-5 text-text-secondary leading-relaxed">{answer}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function FAQContact() {
  const [openFAQ, setOpenFAQ] = useState<number | null>(0);

  return (
    <section id="faq" className="relative overflow-hidden py-20 md:py-28 lg:py-32">
      <div
        className="absolute bottom-0 left-0 w-96 h-96 rounded-full opacity-10 blur-3xl pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(184, 151, 42, 0.3) 0%, transparent 70%)' }}
      />

      <div className="relative max-w-4xl mx-auto px-4 md:px-6 lg:px-8">
        <motion.div
          variants={revealVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-100px' }}
          className="text-center mb-12 md:mb-16"
        >
          <span className="inline-block text-gold text-sm font-medium tracking-wider uppercase mb-4">Pomoc</span>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-text-primary mb-4">Najczęściej zadawane pytania</h2>
          <p className="text-lg text-text-secondary max-w-2xl mx-auto">
            Najważniejsze informacje o rezerwacji, płatności, odbiorze i zasadach wynajmu.
          </p>
        </motion.div>

        <motion.div
          variants={staggerContainerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-50px' }}
        >
          <motion.div variants={staggerItemVariants}>
            <Card variant="glass" padding="none" className="overflow-hidden">
              <div className="px-6 md:px-8" role="region" aria-label="Często zadawane pytania">
                {faqItems.map((item, index) => (
                  <FAQItem
                    key={item.question}
                    index={index}
                    question={item.question}
                    answer={item.answer}
                    isOpen={openFAQ === index}
                    onToggle={() => setOpenFAQ(openFAQ === index ? null : index)}
                  />
                ))}
              </div>
            </Card>
          </motion.div>
        </motion.div>

        <motion.div
          variants={revealVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="mt-10 text-center"
        >
          <p className="text-text-secondary mb-4">Nie znalazłeś odpowiedzi?</p>
          <Link to="/kontakt">
            <Button variant="primary">
              <MessageCircle className="w-4 h-4 mr-2" /> Przejdź do kontaktu
            </Button>
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
