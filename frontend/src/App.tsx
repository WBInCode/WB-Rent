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

      {/* FAQ & Contact Section */}
      <FAQContact />

      {/* Footer */}
      <Footer />
    </div>
  );
}

export default App;
