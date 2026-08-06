import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useLocation, useNavigate } from 'react-router';
import { Navbar } from '@/components/Navbar';
import { Hero } from '@/sections/Hero';
import { ReservationProvider } from '@/context/ReservationContext';
import { AnimatedBackground } from '@/components/AnimatedBackground';

// Lazy load sections below the fold
const Categories = lazy(() => import('@/sections/Categories').then(m => ({ default: m.Categories })));
const EquipmentShowcase = lazy(() => import('@/sections/EquipmentShowcase').then(m => ({ default: m.EquipmentShowcase })));
const HomeHighlights = lazy(() => import('@/sections/HomeHighlights').then(m => ({ default: m.HomeHighlights })));
const Footer = lazy(() => import('@/sections/Footer').then(m => ({ default: m.Footer })));

// Lazy load public subpages
const EquipmentPage = lazy(() => import('@/pages/EquipmentPage'));
const ReservationPage = lazy(() => import('@/pages/ReservationPage'));
const HowItWorksPage = lazy(() => import('@/pages/HowItWorksPage'));

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
const HandoverProtocolPage = lazy(() => import('@/pages/HandoverProtocolPage'));
const ContactPage = lazy(() => import('@/pages/ContactPage'));

// Loading fallback - content-shaped skeleton (less jarring than a spinner)
const SectionLoader = () => (
  <div className="py-20 max-w-7xl mx-auto px-4 md:px-6 lg:px-8" aria-hidden="true">
    <div className="animate-pulse space-y-6">
      <div className="h-4 w-32 rounded-full bg-surface-soft" />
      <div className="h-9 w-2/5 max-w-md rounded-xl bg-surface-strong" />
      <div className="h-4 w-3/5 max-w-xl rounded-full bg-surface-soft" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 pt-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-2xl border border-border bg-surface-soft p-5 space-y-4">
            <div className="h-36 rounded-xl bg-surface-soft" />
            <div className="h-5 w-3/4 rounded-full bg-surface-strong" />
            <div className="h-4 w-1/2 rounded-full bg-surface-soft" />
          </div>
        ))}
      </div>
    </div>
  </div>
);

// Legacy one-page anchors still live in e-mails, the sitemap and search results.
// Map them onto the new subpages so no existing link breaks.
const LEGACY_ANCHORS: Record<string, string> = {
  '#produkty': '/sprzet',
  '#kategorie': '/sprzet',
  '#rezerwacja': '/rezerwacja',
  '#jak-to-dziala': '/jak-to-dziala',
  '#faq': '/jak-to-dziala',
};

function useLegacyAnchorRedirect() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const target = LEGACY_ANCHORS[location.hash];
    if (target) navigate(target, { replace: true });
  }, [location.hash, navigate]);
}

// Main website layout
function MainSite() {
  useLegacyAnchorRedirect();

  return (
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

          <Suspense fallback={<SectionLoader />}>
            <EquipmentShowcase />
          </Suspense>

          <Suspense fallback={<SectionLoader />}>
            <Categories />
          </Suspense>

          <Suspense fallback={<SectionLoader />}>
            <HomeHighlights />
          </Suspense>
        </main>

        {/* Footer */}
        <Suspense fallback={<SectionLoader />}>
          <Footer />
        </Suspense>
      </div>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      {/* Global Animated Background - visible on all pages except admin */}
      <AnimatedBackground />
      {/* Above the router: a selection made in the calculator or on a product
          page must survive the navigation to /rezerwacja. */}
      <ReservationProvider>
        <Suspense fallback={<SectionLoader />}>
          <Routes>
            <Route path="/" element={<MainSite />} />
            <Route path="/sprzet" element={<EquipmentPage />} />
            <Route path="/rezerwacja" element={<ReservationPage />} />
            <Route path="/jak-to-dziala" element={<HowItWorksPage />} />
            <Route path="/produkt/:id" element={<ProductPage />} />
            <Route path="/regulamin" element={<RegulaminPage />} />
            <Route path="/polityka-prywatnosci" element={<PolitykaPrywatnosciPage />} />
            <Route path="/rodo" element={<RodoPage />} />
            <Route path="/platnosc" element={<PaymentReturnPage />} />
            <Route path="/moje-rezerwacje" element={<MyReservationsPage />} />
            <Route path="/kontakt" element={<ContactPage />} />
            <Route path="/podpis/:token" element={<ContractSigningPage />} />
            <Route path="/admin/nowy-wynajem" element={<StaffRentalPage />} />
            <Route path="/admin/wydanie/:id" element={<HandoverProtocolPage />} />
            <Route path="/admin" element={<AdminPanel />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Suspense>
      </ReservationProvider>
    </BrowserRouter>
  );
}

export default App;
