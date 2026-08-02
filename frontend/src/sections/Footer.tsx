import { motion } from 'framer-motion';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  Phone, 
  Mail, 
  MapPin, 
  Clock, 
  Facebook, 
  Instagram, 
  ChevronUp,
  Code2,
} from 'lucide-react';
import { NewsletterSubscribe } from '@/components/NewsletterSubscribe';

const footerLinks = {
  uslugi: [
    { label: 'Wynajem odkurzaczy piorących', href: '/sprzet' },
    { label: 'Wynajem odkurzaczy przemysłowych', href: '/sprzet' },
    { label: 'Wynajem ozonatorów', href: '/sprzet' },
    { label: 'Transport sprzętu', href: '/jak-to-dziala' },
  ],
  informacje: [
    { label: 'Jak to działa', href: '/jak-to-dziala' },
    { label: 'Cennik', href: '/sprzet' },
    { label: 'Moje rezerwacje', href: '/moje-rezerwacje' },
    { label: 'FAQ', href: '/jak-to-dziala' },
    { label: 'Kontakt', href: '/kontakt' },
  ],
  prawne: [
    { label: 'Regulamin', href: '/regulamin' },
    { label: 'Polityka prywatności', href: '/polityka-prywatnosci' },
    { label: 'RODO', href: '/rodo' },
  ],
};

const contactInfo = [
  { icon: Phone, text: '570 038 828', href: 'tel:+48570038828' },
  { icon: Mail, text: 'kontakt@wb-rent.pl', href: 'mailto:kontakt@wb-rent.pl' },
  { icon: MapPin, text: 'ul. Słowackiego 24/11, 35-060 Rzeszów', href: 'https://maps.google.com/?q=Juliusza+Słowackiego+24/11,+35-060+Rzeszów' },
  { icon: Clock, text: 'Pon-Pt: 9:00-17:00, Sob: 9:00-15:00', href: null },
];

export function Footer() {
  const location = useLocation();
  const navigate = useNavigate();
  
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Handle navigation - if link starts with /#, navigate to home and scroll to section
  const handleLinkClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    // If it's a hash link to home page section
    if (href.startsWith('/#')) {
      e.preventDefault();
      const sectionId = href.substring(2); // Remove '/#'
      
      if (location.pathname === '/') {
        // Already on home, just scroll
        const element = document.getElementById(sectionId);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth' });
        }
      } else {
        // Navigate to home, then scroll
        navigate('/');
        setTimeout(() => {
          const element = document.getElementById(sectionId);
          if (element) {
            element.scrollIntoView({ behavior: 'smooth' });
          }
        }, 100);
      }
    } else if (href.startsWith('/') && !href.startsWith('/#')) {
      // For internal pages like /kontakt, use navigate
      e.preventDefault();
      navigate(href);
    }
    // For external links, let default behavior happen
  };

  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-bg-secondary text-text-secondary relative border-t border-border">
      {/* Scroll to top button */}
      <motion.button
        onClick={scrollToTop}
        className="absolute -top-6 left-1/2 -translate-x-1/2 w-12 h-12 bg-gold hover:bg-gold-light text-gold-contrast rounded-full flex items-center justify-center shadow-lg transition-colors"
        whileHover={{ y: -4 }}
        whileTap={{ scale: 0.95 }}
        aria-label="Przewiń do góry"
      >
        <ChevronUp className="w-6 h-6" />
      </motion.button>

      <div className="container mx-auto px-4 pt-16 pb-8">
        {/* Main footer grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8 lg:gap-12">
          {/* Logo & Description */}
          <div className="lg:col-span-2">
            <Link to="/" className="inline-block mb-4">
              <img 
                src="/logo.png" 
                alt="WB-Rent" 
                className="h-12 w-auto"
              />
            </Link>
            <p className="text-text-secondary mb-6 max-w-sm">
              Profesjonalny wynajem sprzętu czyszczącego dla domu i firmy. 
              Odkurzacze piorące, przemysłowe, ozonatory i więcej. 
              Szybka rezerwacja, dostawa pod drzwi.
            </p>
            
            {/* Social media */}
            <div className="flex gap-3">
              <a 
                href="https://www.facebook.com/fbwbpartners" 
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 bg-surface-strong hover:bg-gold rounded-full flex items-center justify-center transition-colors group"
                aria-label="Facebook"
              >
                <Facebook className="w-5 h-5 text-text-secondary group-hover:text-gold-contrast transition-colors" />
              </a>
              <a 
                href="https://www.instagram.com/wbrent.pl/" 
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 bg-surface-strong hover:bg-gold rounded-full flex items-center justify-center transition-colors group"
                aria-label="Instagram"
              >
                <Instagram className="w-5 h-5 text-text-secondary group-hover:text-gold-contrast transition-colors" />
              </a>
            </div>
          </div>

          {/* Usługi */}
          <div>
            <h3 className="text-text-primary font-semibold mb-4">Usługi</h3>
            <ul className="space-y-1">
              {footerLinks.uslugi.map((link) => (
                <li key={link.label}>
                  <a 
                    href={link.href}
                    onClick={(e) => handleLinkClick(e, link.href)}
                    className="inline-flex min-h-[32px] items-center text-text-secondary hover:text-gold transition-colors text-sm"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Informacje */}
          <div>
            <h3 className="text-text-primary font-semibold mb-4">Informacje</h3>
            <ul className="space-y-1">
              {footerLinks.informacje.map((link) => (
                <li key={link.label}>
                  <a 
                    href={link.href}
                    onClick={(e) => handleLinkClick(e, link.href)}
                    className="inline-flex min-h-[32px] items-center text-text-secondary hover:text-gold transition-colors text-sm"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
            
            {/* Prawne */}
            <h3 className="text-text-primary font-semibold mb-4 mt-8">Prawne</h3>
            <ul className="space-y-1">
              {footerLinks.prawne.map((link) => (
                <li key={link.label}>
                  <Link 
                    to={link.href} 
                    className="inline-flex min-h-[32px] items-center text-text-secondary hover:text-gold transition-colors text-sm"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Kontakt */}
          <div>
            <h3 className="text-text-primary font-semibold mb-4">Kontakt</h3>
            <ul className="space-y-4">
              {contactInfo.map((item, index) => {
                const Icon = item.icon;
                const content = (
                  <span className="flex items-start gap-3">
                    <Icon className="w-5 h-5 text-[var(--color-gold)] flex-shrink-0 mt-0.5" />
                    <span className="text-sm">{item.text}</span>
                  </span>
                );
                
                return (
                  <li key={index}>
                    {item.href ? (
                      <a 
                        href={item.href} 
                        className="inline-flex min-h-[32px] items-center text-text-secondary hover:text-text-primary transition-colors"
                      >
                        {content}
                      </a>
                    ) : (
                      <span className="text-text-secondary">{content}</span>
                    )}
                  </li>
                );
              })}
            </ul>

            {/* Newsletter */}
            <div className="mt-6">
              <NewsletterSubscribe variant="inline" />
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="h-px bg-border my-8" />

        {/* Company info */}
        <div className="text-center mb-6 text-xs text-text-muted space-y-1">
          <p className="font-medium text-text-secondary">WB Partners Sp. z o.o.</p>
          <p>NIP: 5170455185 | REGON: 540735769 | KRS: 0001151642</p>
          <p>ul. Słowackiego 24/11, 35-060 Rzeszów</p>
        </div>

        {/* Bottom bar */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-text-muted">
          <p>© {currentYear} WB-Rent. Wszelkie prawa zastrzeżone.</p>
          <p className="inline-flex items-center gap-1.5">
            <Code2 className="w-4 h-4 text-green-500" aria-hidden="true" />
            Projekt i wdrożenie:{' '}
            <a 
              href="https://wb-incode.pl" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-green-500 hover:text-green-400 transition-colors"
            >
              WBInCode
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
