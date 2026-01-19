import { useState } from 'react';
import { Button, Card, CardHeader, CardTitle, CardDescription, CardContent, Input, Select, Badge, Toggle } from '@/components/ui';
import { Search, ArrowRight, CheckCircle } from 'lucide-react';

function App() {
  const [delivery, setDelivery] = useState(false);

  return (
    <div className="min-h-screen bg-bg-primary p-8">
      <div className="max-w-4xl mx-auto space-y-12">
        {/* Header */}
        <header className="text-center space-y-4">
          <h1 className="text-4xl font-bold">
            <span className="text-text-primary">WB-Rent </span>
            <span className="text-gradient-gold">Design System</span>
          </h1>
          <p className="text-text-secondary">
            Komponenty UI dla strony wypożyczalni sprzętu
          </p>
        </header>

        {/* Buttons */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-text-primary">Buttons</h2>
          <div className="flex flex-wrap gap-4">
            <Button variant="primary">Rezerwuj online</Button>
            <Button variant="primary" rightIcon={<ArrowRight className="w-4 h-4" />}>
              Zobacz ceny
            </Button>
            <Button variant="secondary">Zobacz szczegóły</Button>
            <Button variant="outline">Dowiedz się więcej</Button>
            <Button variant="ghost">Anuluj</Button>
            <Button variant="primary" isLoading>
              Wysyłanie...
            </Button>
            <Button variant="primary" disabled>
              Niedostępne
            </Button>
          </div>
          <div className="flex flex-wrap gap-4">
            <Button size="sm" variant="primary">Mały</Button>
            <Button size="md" variant="primary">Średni</Button>
            <Button size="lg" variant="primary">Duży</Button>
          </div>
        </section>

        {/* Badges */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-text-primary">Badges</h2>
          <div className="flex flex-wrap gap-3">
            <Badge variant="success" icon={<CheckCircle className="w-3 h-3" />}>Dostępny</Badge>
            <Badge variant="warning">Wypożyczony</Badge>
            <Badge variant="error">Niedostępny</Badge>
            <Badge variant="gold">Popularne</Badge>
            <Badge variant="default">Wkrótce</Badge>
          </div>
        </section>

        {/* Cards */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-text-primary">Cards</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card hoverable>
              <CardHeader>
                <CardTitle>Ozonator profesjonalny 20g/h</CardTitle>
                <CardDescription>Wydajny generator ozonu do dezynfekcji pomieszczeń</CardDescription>
              </CardHeader>
              <CardContent className="mt-4">
                <ul className="space-y-2 text-sm text-text-secondary">
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-gold rounded-full"></span>
                    20g ozonu/h
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-gold rounded-full"></span>
                    Timer cyfrowy
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-gold rounded-full"></span>
                    Do 200m²
                  </li>
                </ul>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-2xl font-bold text-gold">120 zł</span>
                  <span className="text-text-muted">/doba</span>
                </div>
              </CardContent>
            </Card>

            <Card variant="glow">
              <CardHeader>
                <Badge variant="gold" className="w-fit mb-2">Premium</Badge>
                <CardTitle>Widget z Glow Effect</CardTitle>
                <CardDescription>Karta z efektem złotej poświaty</CardDescription>
              </CardHeader>
            </Card>
          </div>
        </section>

        {/* Form Elements */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-text-primary">Form Elements</h2>
          <Card>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Input 
                label="Imię i nazwisko" 
                placeholder="Jan Kowalski"
                required
              />
              <Input 
                label="Email" 
                type="email" 
                placeholder="jan@example.com"
                required
              />
              <Input 
                label="Szukaj sprzętu" 
                placeholder="Np. ozonator, myjka..."
                leftIcon={<Search className="w-4 h-4" />}
              />
              <Input 
                label="Z błędem" 
                placeholder="Nieprawidłowa wartość"
                error="To pole jest wymagane"
              />
              <Select
                label="Kategoria sprzętu"
                placeholder="Wybierz kategorię"
                required
                options={[
                  { value: 'ozonatory', label: 'Ozonatory' },
                  { value: 'czyszczacy', label: 'Sprzęt czyszczący' },
                ]}
              />
              <Select
                label="Miasto"
                options={[
                  { value: 'warszawa', label: 'Warszawa' },
                  { value: 'krakow', label: 'Kraków' },
                  { value: 'poznan', label: 'Poznań' },
                ]}
              />
            </div>
            <div className="mt-6 pt-6 border-t border-border">
              <Toggle
                label="Dostawa pod adres"
                description="Opcja z transportem (+50 zł)"
                checked={delivery}
                onChange={(e) => setDelivery(e.target.checked)}
              />
            </div>
          </Card>
        </section>

        {/* Footer */}
        <footer className="text-center text-text-muted text-sm pt-8 border-t border-border">
          WB-Rent © 2026 — Design System Preview
        </footer>
      </div>
    </div>
  );
}

export default App;
