import { Home, Phone } from 'lucide-react';
import { Link } from 'react-router';

interface UtilityPageShellProps {
  children: React.ReactNode;
  maxWidth?: 'md' | 'lg' | '3xl';
}

const widths = {
  md: 'max-w-md',
  lg: 'max-w-lg',
  '3xl': 'max-w-3xl',
};

export function UtilityPageShell({ children, maxWidth = 'lg' }: UtilityPageShellProps) {
  return (
    <div className="min-h-screen flex flex-col px-4 sm:px-6 py-5 sm:py-8">
      <header className="w-full max-w-7xl mx-auto flex items-center justify-between gap-4 border-b border-border pb-5">
        <Link to="/" className="inline-flex items-center" aria-label="WB-Rent - strona główna">
          <img src="/logo.png" alt="WB-Rent" className="h-10 sm:h-11 w-auto" />
        </Link>
        <div className="flex items-center gap-2">
          <a
            href="tel:+48570038828"
            className="hidden sm:inline-flex items-center gap-2 px-3 py-2 text-sm text-text-secondary hover:text-gold transition-colors"
          >
            <Phone className="w-4 h-4" aria-hidden="true" /> 570 038 828
          </a>
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-3 py-2 rounded-[--radius-sm] border border-border text-sm text-text-secondary hover:text-text-primary hover:border-gold/30 transition-colors"
          >
            <Home className="w-4 h-4" aria-hidden="true" /> <span className="hidden sm:inline">Strona główna</span>
          </Link>
        </div>
      </header>

      <main className={`w-full ${widths[maxWidth]} mx-auto flex-1 flex flex-col justify-center py-10 sm:py-14`}>
        {children}
      </main>

      <footer className="w-full max-w-7xl mx-auto border-t border-border pt-5 text-xs text-text-muted flex flex-wrap justify-between gap-2">
        <span>WB Partners Sp. z o.o. • Rzeszów</span>
        <a href="mailto:kontakt@wb-rent.pl" className="hover:text-gold transition-colors">kontakt@wb-rent.pl</a>
      </footer>
    </div>
  );
}
