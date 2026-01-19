import { lazy, Suspense } from 'react';
import { Navbar } from '@/components/Navbar';
import { Hero } from '@/sections/Hero';

// Lazy load sections below the fold
const Categories = lazy(() => import('@/sections/Categories').then(m => ({ default: m.Categories })));
const Products = lazy(() => import('@/sections/Products').then(m => ({ default: m.Products })));
const HowItWorks = lazy(() => import('@/sections/HowItWorks').then(m => ({ default: m.HowItWorks })));
const Reservation = lazy(() => import('@/sections/Reservation').then(m => ({ default: m.Reservation })));
const FAQContact = lazy(() => import('@/sections/FAQContact').then(m => ({ default: m.FAQContact })));
const Footer = lazy(() => import('@/sections/Footer').then(m => ({ default: m.Footer })));

// Loading fallback
const SectionLoader = () => (
  <div className="py-20 flex justify-center">
    <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin" />
  </div>
);

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
        {/* Hero Section - not lazy, above the fold */}
        <Hero />

        {/* Lazy loaded sections */}
        <Suspense fallback={<SectionLoader />}>
          <Categories />
        </Suspense>

        <Suspense fallback={<SectionLoader />}>
          <Products />
        </Suspense>

        <Suspense fallback={<SectionLoader />}>
          <HowItWorks />
        </Suspense>

        <Suspense fallback={<SectionLoader />}>
          <Reservation />
        </Suspense>

        <Suspense fallback={<SectionLoader />}>
          <FAQContact />
        </Suspense>
      </main>

      {/* Footer */}
      <Suspense fallback={<SectionLoader />}>
        <Footer />
      </Suspense>
    </div>
  );
}

export default App;
