import { useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Loader2,
  Mail,
  MapPin,
  MessageSquare,
  Phone,
  Send,
  User,
} from 'lucide-react';
import { Button, Card, Input, Textarea } from '@/components/ui';
import { useSubmitForm } from '@/hooks';
import { submitContact, type ContactPayload } from '@/services/api';

const contactInfo = [
  { icon: Phone, label: 'Telefon', value: '570 038 828', href: 'tel:+48570038828' },
  { icon: Mail, label: 'Email', value: 'kontakt@wb-rent.pl', href: 'mailto:kontakt@wb-rent.pl' },
  {
    icon: MapPin,
    label: 'Adres',
    value: 'ul. Słowackiego 24/11, 35-060 Rzeszów',
    href: 'https://maps.google.com/?q=Juliusza+Słowackiego+24/11,+35-060+Rzeszów',
  },
  { icon: Clock, label: 'Godziny', value: 'Pon-Pt: 9-17, Sob: 9-15, Nd: nieczynne', href: null },
];

export function ContactPanel() {
  const [validationError, setValidationError] = useState<string | null>(null);
  const [contactForm, setContactForm] = useState({
    name: '',
    email: '',
    subject: '',
    message: '',
    honeypot: '',
  });

  const {
    status: formStatus,
    error: apiError,
    submit: submitToApi,
  } = useSubmitForm(submitContact, {
    resetOnSuccess: true,
    successTimeout: 5000,
    onSuccess: () => {
      setContactForm({ name: '', email: '', subject: '', message: '', honeypot: '' });
      setValidationError(null);
    },
  });

  const updateField = (field: keyof typeof contactForm, value: string) => {
    setContactForm((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setValidationError(null);
    if (contactForm.honeypot) return;
    if (!contactForm.name || !contactForm.email || !contactForm.message) {
      setValidationError('Wypełnij wszystkie wymagane pola');
      return;
    }
    if (contactForm.message.length < 10) {
      setValidationError(`Wiadomość musi mieć minimum 10 znaków (obecnie: ${contactForm.message.length})`);
      return;
    }
    const payload: ContactPayload = {
      name: contactForm.name,
      email: contactForm.email,
      subject: contactForm.subject || undefined,
      message: contactForm.message,
    };
    await submitToApi(payload);
  };

  const errorMessage = validationError || apiError;

  return (
    <div className="grid lg:grid-cols-[0.9fr_1.1fr] gap-8 lg:gap-12 items-start">
      <div>
        <h2 className="text-2xl font-bold text-text-primary mb-3">Dane kontaktowe</h2>
        <p className="text-text-secondary mb-6">
          Zadzwoń, napisz lub odwiedź nas w Rzeszowie. W sprawie dostępności konkretnego terminu
          najszybciej odpowiemy telefonicznie.
        </p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-1 gap-4">
          {contactInfo.map((info) => {
            const Icon = info.icon;
            const content = (
              <div className="flex items-start gap-4 p-4 rounded-xl bg-bg-card border border-border hover:border-gold/40 transition-colors">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-gold/25 to-gold/5 ring-1 ring-gold/25 flex items-center justify-center shrink-0">
                  <Icon className="w-5 h-5 text-gold-light" />
                </div>
                <div>
                  <p className="text-xs text-text-muted uppercase tracking-wider">{info.label}</p>
                  <p className="text-text-primary font-medium mt-0.5">{info.value}</p>
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
      </div>

      <div>
        <h2 className="text-2xl font-bold text-text-primary mb-3">Napisz do nas</h2>
        <p className="text-text-secondary mb-6">Opisz, jakiego sprzętu lub wsparcia potrzebujesz.</p>

        {formStatus === 'success' ? (
          <Card variant="glow" className="p-10 text-center">
            <CheckCircle2 className="w-14 h-14 text-success mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-text-primary mb-2">Wiadomość wysłana!</h3>
            <p className="text-text-secondary">Dziękujemy za kontakt. Odpowiemy najszybciej jak to możliwe.</p>
          </Card>
        ) : (
          <Card variant="glass" padding="lg">
            <form onSubmit={handleSubmit} className="space-y-4">
              <input
                type="text"
                name="website"
                value={contactForm.honeypot}
                onChange={(event) => updateField('honeypot', event.target.value)}
                className="hidden"
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
              />
              <div className="grid sm:grid-cols-2 gap-4">
                <Input
                  label="Imię"
                  placeholder="Jan Kowalski"
                  value={contactForm.name}
                  onChange={(event) => updateField('name', event.target.value)}
                  leftIcon={<User className="w-4 h-4" />}
                  required
                />
                <Input
                  label="Email"
                  type="email"
                  placeholder="jan@example.com"
                  value={contactForm.email}
                  onChange={(event) => updateField('email', event.target.value)}
                  leftIcon={<Mail className="w-4 h-4" />}
                  required
                />
              </div>
              <Input
                label="Temat (opcjonalnie)"
                placeholder="W czym możemy pomóc?"
                value={contactForm.subject}
                onChange={(event) => updateField('subject', event.target.value)}
                leftIcon={<MessageSquare className="w-4 h-4" />}
              />
              <Textarea
                label="Wiadomość"
                placeholder="Napisz swoją wiadomość..."
                value={contactForm.message}
                onChange={(event) => updateField('message', event.target.value)}
                rows={7}
                required
              />
              <p className={`text-xs text-right -mt-2 ${contactForm.message.length < 10 ? 'text-error' : 'text-text-muted'}`}>
                {contactForm.message.length}/10 minimum znaków
              </p>
              {formStatus === 'error' && errorMessage && (
                <div className="p-3 rounded-lg bg-error/10 border border-error/20 flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-error shrink-0 mt-0.5" />
                  <p className="text-sm text-error">{errorMessage}</p>
                </div>
              )}
              <Button type="submit" variant="primary" size="lg" className="w-full" disabled={formStatus === 'loading'}>
                {formStatus === 'loading' ? (
                  <><Loader2 className="w-5 h-5 animate-spin mr-2" /> Wysyłanie...</>
                ) : (
                  <><Send className="w-5 h-5 mr-2" /> Wyślij wiadomość</>
                )}
              </Button>
            </form>
          </Card>
        )}
      </div>
    </div>
  );
}
