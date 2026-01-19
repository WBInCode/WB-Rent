import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X } from 'lucide-react';
import { Button } from '@/components/ui';
import { cn } from '@/lib/utils';
import { navbarVariants, transitions } from '@/lib/motion';

interface NavLink {
  label: string;
  href: string;
}

const navLinks: NavLink[] = [
  { label: 'Start', href: '#start' },
  { label: 'Kategorie', href: '#kategorie' },
  { label: 'Produkty', href: '#produkty' },
  { label: 'Jak to działa', href: '#jak-to-dziala' },
  { label: 'Rezerwacja', href: '#rezerwacja' },
  { label: 'FAQ', href: '#faq' },
];

export function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState('start');

  // Handle scroll effect
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Handle active section detection
  useEffect(() => {
    const handleScroll = () => {
      const sections = navLinks.map(link => link.href.replace('#', ''));
      
      for (const section of sections.reverse()) {
        const element = document.getElementById(section);
        if (element) {
          const rect = element.getBoundingClientRect();
          if (rect.top <= 100) {
            setActiveSection(section);
            break;
          }
        }
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close mobile menu on resize
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setIsMobileMenuOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isMobileMenuOpen]);

  const handleNavClick = (href: string) => {
    setIsMobileMenuOpen(false);
    const element = document.querySelector(href);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <>
      <motion.header
        role="banner"
        variants={navbarVariants}
        initial="top"
        animate={isScrolled ? 'scrolled' : 'top'}
        transition={transitions.normal}
        className={cn(
          'fixed top-0 left-0 right-0 z-50',
          'px-4 md:px-6 lg:px-8',
          'transition-all duration-300'
        )}
      >
        <nav aria-label="Główna nawigacja" className="max-w-7xl mx-auto h-16 md:h-20 flex items-center justify-between">
          {/* Logo */}
          <a 
            href="#start" 
            onClick={(e) => { e.preventDefault(); handleNavClick('#start'); }}
            className="flex items-center group"
          >
            <img 
              src="/logo.png" 
              alt="WB-Rent" 
              className="h-10 md:h-12 w-auto"
            />
          </a>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={(e) => { e.preventDefault(); handleNavClick(link.href); }}
                className={cn(
                  'px-4 py-2 text-sm font-medium rounded-lg transition-colors',
                  activeSection === link.href.replace('#', '')
                    ? 'text-gold'
                    : 'text-text-secondary hover:text-text-primary hover:bg-white/5'
                )}
              >
                {link.label}
              </a>
            ))}
          </div>

          {/* Desktop CTA */}
          <div className="hidden md:flex items-center gap-3">
            <Button 
              variant="primary" 
              size="sm"
              onClick={() => handleNavClick('#kontakt')}
            >
              Skontaktuj się
            </Button>
          </div>

          {/* Mobile Menu Button */}
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="md:hidden p-2 text-text-secondary hover:text-text-primary transition-colors"
            aria-label={isMobileMenuOpen ? 'Zamknij menu' : 'Otwórz menu'}
          >
            {isMobileMenuOpen ? (
              <X className="w-6 h-6" />
            ) : (
              <Menu className="w-6 h-6" />
            )}
          </button>
        </nav>
      </motion.header>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={transitions.fast}
            className="fixed inset-0 z-40 bg-bg-primary/95 backdrop-blur-lg md:hidden"
          >
            <nav aria-label="Menu mobilne" className="flex flex-col items-center justify-center h-full gap-6 p-8">
              {navLinks.map((link, index) => (
                <motion.a
                  key={link.href}
                  href={link.href}
                  onClick={(e) => { e.preventDefault(); handleNavClick(link.href); }}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  transition={{ ...transitions.normal, delay: index * 0.05 }}
                  className={cn(
                    'text-2xl font-medium transition-colors',
                    activeSection === link.href.replace('#', '')
                      ? 'text-gold'
                      : 'text-text-secondary hover:text-text-primary'
                  )}
                >
                  {link.label}
                </motion.a>
              ))}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                transition={{ ...transitions.normal, delay: navLinks.length * 0.05 }}
                className="mt-4"
              >
                <Button 
                  variant="primary" 
                  size="lg"
                  onClick={() => handleNavClick('#kontakt')}
                >
                  Skontaktuj się
                </Button>
              </motion.div>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Spacer for fixed navbar */}
      <div className="h-16 md:h-20" />
    </>
  );
}
