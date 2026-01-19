import { Navbar } from '@/components/Navbar';

function App() {
  return (
    <div className="min-h-screen bg-bg-primary">
      <Navbar />
      
      {/* Placeholder sections for testing navigation */}
      <section id="start" className="min-h-screen flex items-center justify-center">
        <h1 className="text-4xl font-bold text-text-primary">
          <span className="text-gold">WB-Rent</span> — Start
        </h1>
      </section>

      <section id="kategorie" className="min-h-screen flex items-center justify-center bg-bg-secondary">
        <h2 className="text-3xl font-bold text-text-primary">Kategorie</h2>
      </section>

      <section id="produkty" className="min-h-screen flex items-center justify-center">
        <h2 className="text-3xl font-bold text-text-primary">Produkty</h2>
      </section>

      <section id="jak-to-dziala" className="min-h-screen flex items-center justify-center bg-bg-secondary">
        <h2 className="text-3xl font-bold text-text-primary">Jak to działa</h2>
      </section>

      <section id="rezerwacja" className="min-h-screen flex items-center justify-center">
        <h2 className="text-3xl font-bold text-text-primary">Rezerwacja</h2>
      </section>

      <section id="faq" className="min-h-screen flex items-center justify-center bg-bg-secondary">
        <h2 className="text-3xl font-bold text-text-primary">FAQ</h2>
      </section>
    </div>
  );
}

export default App;
