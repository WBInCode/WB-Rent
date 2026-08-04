import { Link } from 'react-router';
import { Home, Search } from 'lucide-react';
import { Button } from '@/components/ui';
import { UtilityPageShell } from '@/components/UtilityPageShell';

export function NotFoundPage() {
  return (
    <UtilityPageShell maxWidth="lg">
      <section className="text-center border-y border-white/10 py-10 sm:py-14">
        <p className="text-6xl sm:text-7xl font-bold text-gradient-gold mb-2" style={{ fontFamily: 'var(--font-family-display)' }}>
          404
        </p>
        <h1 className="text-2xl font-bold text-text-primary mb-3">Strona nie istnieje</h1>
        <p className="text-text-secondary mb-8">
          Podany adres jest nieprawidłowy lub strona została przeniesiona.
        </p>
        <div className="flex flex-wrap gap-3 justify-center">
          <Link to="/">
            <Button variant="primary">
              <Home className="w-4 h-4 mr-2" />
              Strona główna
            </Button>
          </Link>
          <Link to="/sprzet">
            <Button variant="secondary">
              <Search className="w-4 h-4 mr-2" />
              Zobacz produkty
            </Button>
          </Link>
        </div>
      </section>
    </UtilityPageShell>
  );
}

export default NotFoundPage;
