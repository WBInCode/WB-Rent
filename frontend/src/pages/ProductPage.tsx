import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  ArrowLeft, 
  Calendar, 
  Truck, 
  Package, 
  Check, 
  Plus, 
  Clock, 
  Star,
  Info,
  MapPin,
  Phone
} from 'lucide-react';
import { Button, Card } from '@/components/ui';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/sections/Footer';
import { ProductGallery } from '@/components/ProductGallery';
import { getProductById, getCategoryById, getProductImages } from '@/data/products';
import { formatPrice } from '@/lib/utils';
import { revealVariants, staggerContainerVariants, staggerItemVariants } from '@/lib/motion';
import { getProductsAvailability } from '@/services/api';

export function ProductPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const product = id ? getProductById(id) : undefined;
  const category = product ? getCategoryById(product.categoryId) : undefined;
  const [isAvailable, setIsAvailable] = useState<boolean>(product?.available ?? false);

  // Scroll to top on page load
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [id]);

  // Fetch real-time availability
  useEffect(() => {
    if (!id) return;
    
    const fetchAvailability = async () => {
      try {
        const response = await getProductsAvailability();
        if (response.success && response.data) {
          setIsAvailable(response.data.availability[id] !== false);
        }
      } catch (error) {
        console.error('Failed to fetch availability:', error);
      }
    };

    fetchAvailability();
    // Refresh every 30 seconds
    const interval = setInterval(fetchAvailability, 30000);
    return () => clearInterval(interval);
  }, [id]);

  if (!product) {
    return (
      <div className="min-h-screen bg-bg-primary">
        <Navbar />
        <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
          <h1 className="text-2xl font-bold text-text-primary mb-4">Produkt nie znaleziony</h1>
          <p className="text-text-muted mb-8">Produkt o podanym ID nie istnieje.</p>
          <Button variant="primary" onClick={() => navigate('/')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Wróć do strony głównej
          </Button>
        </div>
        <Footer />
      </div>
    );
  }

  const handleReservation = () => {
    // Navigate to home and scroll to reservation with product preselected
    navigate('/#rezerwacja', { state: { productId: product.id, categoryId: product.categoryId } });
    
    // Delay scroll to ensure navigation completes
    setTimeout(() => {
      const element = document.getElementById('rezerwacja');
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
      }
    }, 100);
  };

  return (
    <div className="min-h-screen bg-bg-primary">
      <Navbar />
      
      <main className="pt-24 pb-20">
        <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8">
          {/* Breadcrumb */}
          <motion.nav 
            variants={revealVariants}
            initial="hidden"
            animate="visible"
            className="mb-8"
          >
            <ol className="flex items-center gap-2 text-sm text-text-muted">
              <li>
                <Link to="/" className="hover:text-gold transition-colors">Strona główna</Link>
              </li>
              <li>/</li>
              <li>
                <Link to="/#produkty" className="hover:text-gold transition-colors">Produkty</Link>
              </li>
              <li>/</li>
              {category && (
                <>
                  <li className="text-text-secondary">{category.name}</li>
                  <li>/</li>
                </>
              )}
              <li className="text-gold font-medium truncate max-w-[200px]">{product.name}</li>
            </ol>
          </motion.nav>

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
            {/* Left: Image */}
            <motion.div
              variants={revealVariants}
              initial="hidden"
              animate="visible"
            >
              <Card variant="glass" className="p-4 md:p-6 overflow-hidden">
                {/* Product Gallery */}
                <ProductGallery
                  images={getProductImages(product)}
                  productName={product.name}
                  available={isAvailable}
                />

                {/* Quick Info under image */}
                <div className="mt-4 grid grid-cols-3 gap-4 text-center">
                  <div className="p-3 bg-bg-primary/50">
                    <Truck className="w-5 h-5 mx-auto text-gold mb-1" />
                    <p className="text-xs text-text-muted">Dostawa</p>
                    <p className="text-sm font-semibold text-text-primary">{product.transportPrice} zł</p>
                  </div>
                  <div className="p-3 bg-bg-primary/50">
                    <Clock className="w-5 h-5 mx-auto text-gold mb-1" />
                    <p className="text-xs text-text-muted">Weekend</p>
                    <p className="text-sm font-semibold text-text-primary">+{product.weekendPickupFee} zł</p>
                  </div>
                  <div className="p-3 bg-bg-primary/50">
                    <Star className="w-5 h-5 mx-auto text-gold mb-1" />
                    <p className="text-xs text-text-muted">Kategoria</p>
                    <p className="text-sm font-semibold text-text-primary truncate">{category?.name.split(' ')[0]}</p>
                  </div>
                </div>
              </Card>
            </motion.div>

            {/* Right: Details */}
            <motion.div
              variants={staggerContainerVariants}
              initial="hidden"
              animate="visible"
              className="space-y-6"
            >
              {/* Title & Description */}
              <motion.div variants={staggerItemVariants}>
                <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-text-primary mb-4">
                  {product.name}
                </h1>
                <p className="text-text-secondary text-lg leading-relaxed">
                  {product.description}
                </p>
              </motion.div>

              {/* Features */}
              {product.features.length > 0 && (
                <motion.div variants={staggerItemVariants}>
                  <div className="flex flex-wrap gap-2">
                    {product.features.map((feature, index) => (
                      <span
                        key={index}
                      className="px-3 py-1.5 bg-gold/10 text-gold text-sm font-medium border border-gold/20"
                      >
                        {feature}
                      </span>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* Pricing Card */}
              <motion.div variants={staggerItemVariants}>
                <Card variant="glow" className="p-6">
                  <h3 className="text-lg font-semibold text-gold mb-4 flex items-center gap-2">
                    <Calendar className="w-5 h-5" />
                    Cennik wynajmu
                  </h3>
                  
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-bg-primary/50 hover:bg-bg-primary/70 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gold/20 flex items-center justify-center">
                          <span className="text-gold font-bold">1</span>
                        </div>
                        <div>
                          <p className="font-medium text-text-primary">Pierwsza doba</p>
                          <p className="text-xs text-text-muted">Podstawowa stawka</p>
                        </div>
                      </div>
                      <p className="text-xl font-bold text-gold">{formatPrice(product.pricePerDay)}</p>
                    </div>

                    <div className="flex items-center justify-between p-3 bg-bg-primary/50 hover:bg-bg-primary/70 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-500/20 flex items-center justify-center">
                          <Plus className="w-4 h-4 text-blue-400" />
                        </div>
                        <div>
                          <p className="font-medium text-text-primary">Każda kolejna doba</p>
                          <p className="text-xs text-text-muted">Od 2 dnia</p>
                        </div>
                      </div>
                      <p className="text-xl font-bold text-blue-400">{formatPrice(product.priceNextDay)}</p>
                    </div>

                    <div className="flex items-center justify-between p-3 bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/20 hover:border-purple-500/40 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-purple-500/20 flex items-center justify-center">
                          <Star className="w-4 h-4 text-purple-400" />
                        </div>
                        <div>
                          <p className="font-medium text-text-primary">Wynajem weekendowy</p>
                          <p className="text-xs text-text-muted">Pt-Pon (3 dni w cenie)</p>
                        </div>
                      </div>
                      <p className="text-xl font-bold text-purple-400">{formatPrice(product.priceWeekend)}</p>
                    </div>
                  </div>

                  {/* Example calculation */}
                  <div className="mt-4 p-4 bg-bg-secondary/50 border border-border">
                    <p className="text-sm text-text-muted mb-2 flex items-center gap-1">
                      <Info className="w-4 h-4" />
                      Przykład: 5 dni wynajmu
                    </p>
                    <p className="text-text-primary">
                      {formatPrice(product.pricePerDay)} + {4} × {formatPrice(product.priceNextDay)} = {' '}
                      <span className="text-gold font-bold">
                        {formatPrice(product.pricePerDay + 4 * product.priceNextDay)}
                      </span>
                    </p>
                  </div>
                </Card>
              </motion.div>

              {/* Accessories */}
              <motion.div variants={staggerItemVariants}>
                <Card variant="glass" className="p-6">
                  <h3 className="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">
                    <Package className="w-5 h-5 text-gold" />
                    Akcesoria
                  </h3>

                  {/* Included */}
                  {product.includedAccessories.length > 0 && (
                    <div className="mb-4">
                      <p className="text-sm font-medium text-green-400 mb-2">W cenie wypożyczenia:</p>
                      <ul className="space-y-2">
                        {product.includedAccessories.map((acc, index) => (
                          <li key={index} className="flex items-center gap-2 text-text-secondary">
                            <Check className="w-4 h-4 text-green-400 shrink-0" />
                            <span>{acc}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Optional */}
                  {product.optionalAccessories.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-text-muted mb-2">
                        Dodatkowo płatne ({product.accessoryPrice ? `+${product.accessoryPrice} zł/szt.` : 'cena ustalana indywidualnie'}):
                      </p>
                      <ul className="space-y-2">
                        {product.optionalAccessories.map((acc, index) => (
                          <li key={index} className="flex items-center gap-2 text-text-secondary">
                            <Plus className="w-4 h-4 text-gold shrink-0" />
                            <span>{acc}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {product.includedAccessories.length === 0 && product.optionalAccessories.length === 0 && (
                    <p className="text-text-muted">Brak dodatkowych akcesoriów.</p>
                  )}
                </Card>
              </motion.div>

              {/* CTA Buttons */}
              <motion.div variants={staggerItemVariants} className="flex flex-col sm:flex-row gap-4">
                <Button
                  variant="primary"
                  size="lg"
                  className="flex-1"
                  onClick={handleReservation}
                  disabled={!isAvailable}
                >
                  <Calendar className="w-5 h-5 mr-2" />
                  {isAvailable ? 'Zarezerwuj teraz' : 'Obecnie niedostępny'}
                </Button>
                <Button
                  variant="secondary"
                  size="lg"
                  className="flex-1"
                  onClick={() => {
                    navigate('/#kontakt');
                    setTimeout(() => {
                      document.getElementById('kontakt')?.scrollIntoView({ behavior: 'smooth' });
                    }, 100);
                  }}
                >
                  <Phone className="w-5 h-5 mr-2" />
                  Zapytaj o produkt
                </Button>
              </motion.div>

              {/* Contact Info */}
              <motion.div variants={staggerItemVariants}>
                <div className="p-4 rounded-lg bg-bg-secondary/50 border border-border">
                  <p className="text-sm text-text-muted mb-2">Potrzebujesz więcej informacji?</p>
                  <div className="flex flex-wrap gap-4 text-sm">
                    <a href="tel:+48570038828" className="flex items-center gap-2 text-gold hover:text-gold-light transition-colors">
                      <Phone className="w-4 h-4" />
                      570 038 828
                    </a>
                    <span className="flex items-center gap-2 text-text-secondary">
                      <MapPin className="w-4 h-4" />
                      ul. Słowackiego 24/11, Rzeszów
                    </span>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          </div>

          {/* Back button */}
          <motion.div
            variants={revealVariants}
            initial="hidden"
            animate="visible"
            className="mt-12"
          >
            <Button
              variant="ghost"
              onClick={() => navigate(-1)}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Powrót
            </Button>
          </motion.div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
