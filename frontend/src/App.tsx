import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Navbar } from '@/components/Navbar';
import { Hero } from '@/sections/Hero';
import { ReservationProvider } from '@/context/ReservationContext';
import { AnimatedBackground } from '@/components/AnimatedBackground';

// Lazy load sections below the fold
const Categories = lazy(() => import('@/sections/Categories').then(m => ({ default: m.Categories })));
const Products = lazy(() => import('@/sections/Products').then(m => ({ default: m.Products })));
const HowItWorks = lazy(() => import('@/sections/HowItWorks').then(m => ({ default: m.HowItWorks })));
const Reservation = lazy(() => import('@/sections/Reservation').then(m => ({ default: m.Reservation })));
const FAQContact = lazy(() => import('@/sections/FAQContact').then(m => ({ default: m.FAQContact })));
const Footer = lazy(() => import('@/sections/Footer').then(m => ({ default: m.Footer })));

// Lazy load admin panel
const AdminPanel = lazy(() => import('@/pages/AdminPanel').then(m => ({ default: m.AdminPanel })));

// Lazy load product page
const ProductPage = lazy(() => import('@/pages/ProductPage').then(m => ({ default: m.ProductPage })));

// Lazy load legal pages
const RegulaminPage = lazy(() => import('@/pages/RegulaminPage').then(m => ({ default: m.RegulaminPage })));
const PolitykaPrywatnosciPage = lazy(() => import('@/pages/PolitykaPrywatnosciPage').then(m => ({ default: m.PolitykaPrywatnosciPage })));
const RodoPage = lazy(() => import('@/pages/RodoPage').then(m => ({ default: m.RodoPage })));

// Lazy load other pages
const PaymentReturnPage = lazy(() => import('@/pages/PaymentReturnPage'));
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'));
const MyReservationsPage = lazy(() => import('@/pages/MyReservationsPage'));
const ContractSigningPage = lazy(() => import('@/pages/ContractSigningPage'));
const StaffRentalPage = lazy(() => import('@/pages/StaffRentalPage'));
const ContactPage = lazy(() => import('@/pages/ContactPage'));

// Loading fallback - content-shaped skeleton (less jarring than a spinner)
const SectionLoader = () => (
  <div className="py-20 max-w-7xl mx-auto px-4 md:px-6 lg:px-8" aria-hidden="true">
    <div className="animate-pulse space-y-6">
      <div className="h-4 w-32 rounded-full bg-white/5" />
      <div className="h-9 w-2/5 max-w-md rounded-xl bg-white/10" />
      <div className="h-4 w-3/5 max-w-xl rounded-full bg-white/5" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 pt-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-2xl border border-white/5 bg-white/[0.03] p-5 space-y-4">
            <div className="h-36 rounded-xl bg-white/5" />
            <div className="h-5 w-3/4 rounded-full bg-white/10" />
            <div className="h-4 w-1/2 rounded-full bg-white/5" />
          </div>
        ))}
      </div>
    </div>
  </div>
);

// Main website layout
function MainSite() {
  return (
    <ReservationProvider>
      <div className="min-h-screen bg-transparent relative">
        {/* Content wrapper - above background */}
        <div className="relative" style={{ zIndex: 1 }}>
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
      </div>
    </ReservationProvider>
  );
}

function App() {
  return (
    <BrowserRouter>
      {/* Global Animated Background - visible on all pages except admin */}
      <AnimatedBackground />
      <Suspense fallback={<SectionLoader />}>
        <Routes>
          <Route path="/" element={<MainSite />} />
          <Route path="/produkt/:id" element={<ProductPage />} />
          <Route path="/regulamin" element={<RegulaminPage />} />
          <Route path="/polityka-prywatnosci" element={<PolitykaPrywatnosciPage />} />
          <Route path="/rodo" element={<RodoPage />} />
          <Route path="/platnosc" element={<PaymentReturnPage />} />
          <Route path="/moje-rezerwacje" element={<MyReservationsPage />} />
          <Route path="/kontakt" element={<ContactPage />} />
          <Route path="/podpis/:token" element={<ContractSigningPage />} />
          <Route path="/admin/nowy-wynajem" element={<StaffRentalPage />} />
          <Route path="/admin" element={<AdminPanel />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

export default App;
