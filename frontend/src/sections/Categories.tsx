import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Wind, Sparkles, ArrowRight, Cloud, Wrench } from 'lucide-react';
import { Button, Card } from '@/components/ui';
import { categories, getProductsByCategory } from '@/data/products';
import { staggerContainerVariants, staggerItemVariants, revealVariants } from '@/lib/motion';
import { getProductsAvailability } from '@/services/api';

// Map category icon string to Lucide component
const categoryIcons: Record<string, React.ElementType> = {
  wind: Wind,
  sparkles: Sparkles,
  cloud: Cloud,
  wrench: Wrench,
};

// Helper to determine availability status color
// green = all available, yellow = half available, orange = 1 left, red = none
function getAvailabilityColor(available: number, total: number): string {
  if (available === 0) return 'bg-red-500';
  if (available === 1) return 'bg-orange-500';
  if (available <= total / 2) return 'bg-yellow-500';
  return 'bg-green-500';
}

// Helper to determine product availability dot color
function getProductDotColor(isAvailable: boolean): string {
  return isAvailable ? 'bg-green-500' : 'bg-red-500';
}

export function Categories() {
  const [availability, setAvailability] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(true);

  // Fetch real-time availability
  useEffect(() => {
    const fetchAvailability = async () => {
      try {
        const response = await getProductsAvailability();
        if (response.success && response.data) {
          setAvailability(response.data.availability);
        }
      } catch (error) {
        console.error('Failed to fetch availability:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAvailability();
    // Refresh every 30 seconds
    const interval = setInterval(fetchAvailability, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleScrollToProducts = (categoryId: string) => {
    // Scroll to products and potentially filter by category
    document.getElementById('produkty')?.scrollIntoView({ behavior: 'smooth' });
    // TODO: Implement category filtering in products section
    console.log('Filter by category:', categoryId);
  };

  return (
    <section id="kategorie" className="relative overflow-hidden py-20 md:py-28 lg:py-32">
      {/* Background decoration */}
      <div 
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full opacity-10 blur-3xl pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(245, 158, 11, 0.15) 0%, transparent 60%)' }}
      />

      <div className="relative max-w-7xl mx-auto px-4 md:px-6 lg:px-8">
        {/* Section Header */}
        <motion.div
          variants={revealVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-100px' }}
          className="text-center mb-12 md:mb-16"
        >
          <span className="inline-block text-gold text-sm font-medium tracking-wider uppercase mb-4">
            Nasza oferta
          </span>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-text-primary mb-4">
            Kategorie sprzętu
          </h2>
          <p className="text-lg text-text-secondary max-w-2xl mx-auto">
            Wybierz kategorię i odkryj nasz profesjonalny sprzęt dostępny do wynajęcia. 
            Wszystkie urządzenia są regularnie serwisowane i gotowe do pracy.
          </p>
        </motion.div>

        {/* Categories Grid */}
        <motion.div
          variants={staggerContainerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-100px' }}
          className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8"
        >
          {categories.map((category) => {
            const Icon = categoryIcons[category.icon] || Sparkles;
            const productsInCategory = getProductsByCategory(category.id);
            const totalCount = productsInCategory.length;
            
            // Calculate real-time availability based on API response
            const availableCount = isLoading 
              ? productsInCategory.filter((p) => p.available).length // fallback to static
              : productsInCategory.filter((p) => availability[p.id] !== false).length;
            
            const minPrice = Math.min(...productsInCategory.map((p) => p.pricePerDay));
            const availabilityDotColor = getAvailabilityColor(availableCount, totalCount);

            return (
              <motion.div key={category.id} variants={staggerItemVariants}>
                <Card 
                  variant="glass" 
                  hoverable 
                  padding="none"
                  className="h-full group"
                >
                  <div className="p-6 md:p-8 lg:p-10">
                    {/* Icon */}
                    <div className="mb-6">
                      <div className="w-14 h-14 md:w-16 md:h-16 rounded-2xl bg-gold/10 flex items-center justify-center group-hover:bg-gold/20 transition-colors duration-300">
                        <Icon className="w-7 h-7 md:w-8 md:h-8 text-gold" />
                      </div>
                    </div>

                    {/* Content */}
                    <h3 className="text-xl md:text-2xl font-bold text-text-primary mb-3 group-hover:text-gold transition-colors duration-300">
                      {category.name}
                    </h3>
                    <p className="text-text-secondary mb-6 leading-relaxed min-h-[3rem] line-clamp-2">
                      {category.description}
                    </p>

                    {/* Stats row */}
                    <div className="flex flex-wrap gap-4 mb-6 text-sm">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${availabilityDotColor} transition-colors`} />
                        <span className="text-text-muted">
                          <span className="text-text-primary font-semibold">{availableCount}</span> dostępnych
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-text-muted">
                          od <span className="text-gold font-semibold">{minPrice} zł</span>/dzień
                        </span>
                      </div>
                    </div>

                    {/* Products preview - fixed height for 3 items */}
                    <div className="mb-6 space-y-2 min-h-[9.5rem]">
                      {productsInCategory.slice(0, 3).map((product) => {
                        const isProductAvailable = isLoading 
                          ? product.available 
                          : availability[product.id] !== false;
                        
                        return (
                          <div 
                            key={product.id}
                            className="flex items-center justify-between py-2 px-3 rounded-lg bg-bg-primary/50 text-sm"
                          >
                            <span className="text-text-secondary truncate max-w-[60%]">{product.name}</span>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <span className="text-gold font-medium">{product.pricePerDay} zł</span>
                              <span 
                                className={`w-2 h-2 rounded-full transition-colors ${getProductDotColor(isProductAvailable)}`}
                                title={isProductAvailable ? 'Dostępny' : 'Wypożyczony'}
                              />
                            </div>
                          </div>
                        );
                      })}
                      {productsInCategory.length > 3 && (
                        <p className="text-xs text-text-muted text-center py-1">
                          +{productsInCategory.length - 3} więcej urządzeń
                        </p>
                      )}
                    </div>

                    {/* CTA */}
                    <Button 
                      variant="secondary" 
                      size="md"
                      className="w-full group/btn"
                      onClick={() => handleScrollToProducts(category.id)}
                    >
                      <span>Zobacz wszystkie</span>
                      <ArrowRight className="w-4 h-4 ml-2 group-hover/btn:translate-x-1 transition-transform duration-200" />
                    </Button>
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </motion.div>

        {/* Bottom CTA */}
        <motion.div
          variants={revealVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-50px' }}
          className="text-center mt-12 md:mt-16"
        >
          <p className="text-text-muted mb-4">
            Nie wiesz, czego potrzebujesz?
          </p>
          <Button 
            variant="ghost" 
            size="lg"
            onClick={() => document.getElementById('faq')?.scrollIntoView({ behavior: 'smooth' })}
          >
            Skontaktuj się z nami
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </motion.div>
      </div>
    </section>
  );
}
