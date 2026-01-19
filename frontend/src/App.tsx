import { Navbar } from '@/components/Navbar';
import { Hero } from '@/sections/Hero';
import { Categories } from '@/sections/Categories';
import { Products } from '@/sections/Products';
import { HowItWorks } from '@/sections/HowItWorks';
import { Reservation } from '@/sections/Reservation';
import { FAQContact } from '@/sections/FAQContact';
import { Footer } from '@/sections/Footer';

function App() {
  return (
    <div className="min-h-screen bg-bg-primary">
      {/* Skip to main content link for keyboard users */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-gold focus:text-bg-primary focus:rounded-lg focus:font-medium"
      >
        Przejdź do treści głównej
      </a>

      <Navbar />
      
      <main id="main-content" role="main">
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

        {/* FAQ & Contact Section */}
        <FAQContact />
      </main>

      {/* Footer */}
      <Footer />
    </div>
  );
}

export default App;
