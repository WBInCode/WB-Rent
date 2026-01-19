import { motion } from 'framer-motion';
import { Wind, Sparkles, ArrowRight, Cloud, Wrench } from 'lucide-react';
import { Button, Card } from '@/components/ui';
import { categories, getProductsByCategory } from '@/data/products';
import { staggerContainerVariants, staggerItemVariants, revealVariants } from '@/lib/motion';

// Map category icon string to Lucide component
const categoryIcons: Record<string, React.ElementType> = {
  wind: Wind,
  sparkles: Sparkles,
  cloud: Cloud,
  wrench: Wrench,
};

export function Categories() {
  const handleScrollToProducts = (categoryId: string) => {
    // Scroll to products and potentially filter by category
    document.getElementById('produkty')?.scrollIntoView({ behavior: 'smooth' });
    // TODO: Implement category filtering in products section
    console.log('Filter by category:', categoryId);
  };

  return (
    <section id="kategorie" className="relative overflow-hidden py-20 md:py-28 lg:py-32 bg-bg-secondary">
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
            const availableCount = productsInCategory.filter((p) => p.available).length;
            const minPrice = Math.min(...productsInCategory.map((p) => p.pricePerDay));

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
                    <p className="text-text-secondary mb-6 leading-relaxed">
                      {category.description}
                    </p>

                    {/* Stats row */}
                    <div className="flex flex-wrap gap-4 mb-6 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-green-500" />
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

                    {/* Products preview */}
                    <div className="mb-6 space-y-2">
                      {productsInCategory.slice(0, 3).map((product) => (
                        <div 
                          key={product.id}
                          className="flex items-center justify-between py-2 px-3 rounded-lg bg-bg-primary/50 text-sm"
                        >
                          <span className="text-text-secondary">{product.name}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-gold font-medium">{product.pricePerDay} zł</span>
                            <span 
                              className={`w-2 h-2 rounded-full ${product.available ? 'bg-green-500' : 'bg-red-500'}`}
                              title={product.available ? 'Dostępny' : 'Wypożyczony'}
                            />
                          </div>
                        </div>
                      ))}
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
            onClick={() => document.getElementById('kontakt')?.scrollIntoView({ behavior: 'smooth' })}
          >
            Skontaktuj się z nami
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </motion.div>
      </div>
    </section>
  );
}
