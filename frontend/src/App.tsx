import { Navbar } from '@/components/Navbar';
import { Hero } from '@/sections/Hero';
import { Categories } from '@/sections/Categories';
import { Products } from '@/sections/Products';
import { HowItWorks } from '@/sections/HowItWorks';
import { Reservation } from '@/sections/Reservation';

function App() {
  return (
    <div className="min-h-screen bg-bg-primary">
      <Navbar />
      
      {/* Hero Section */}
      <Hero />

      {/* Categories Section */}
      <Categories />

      {/* Products Section */}
      <Products />

      {/* How It Works Section */}
      <HowItWorks />

      {/* Reservation Section */}
      <Reservation />

      <section id="faq" className="min-h-screen flex items-center justify-center bg-bg-secondary">
        <h2 className="text-3xl font-bold text-text-primary">FAQ</h2>
      </section>
    </div>
  );
}

export default App;
