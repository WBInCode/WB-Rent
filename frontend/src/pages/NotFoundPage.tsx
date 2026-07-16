import { Link } from 'react-router-dom';
import { Home, Search } from 'lucide-react';
import { Button, Card } from '@/components/ui';

export function NotFoundPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <Card variant="glass" className="max-w-md w-full p-10 text-center">
        <p className="text-7xl font-bold text-gradient-gold mb-2" style={{ fontFamily: 'var(--font-family-display)' }}>
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
          <Link to="/#produkty">
            <Button variant="secondary">
              <Search className="w-4 h-4 mr-2" />
              Zobacz produkty
            </Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}

export default NotFoundPage;
