import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Grid3X3, LayoutList } from 'lucide-react';
import { Input, Button } from '@/components/ui';
import { ProductCard } from '@/components/ProductCard';
import { products, categories, getProductsByCategory } from '@/data/products';
import { staggerContainerVariants, staggerItemVariants, revealVariants } from '@/lib/motion';

type ViewMode = 'grid' | 'list';

export function Products() {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');

  // Filter products
  const filteredProducts = products.filter((product) => {
    const matchesCategory = !activeCategory || product.categoryId === activeCategory;
    const matchesSearch = !searchQuery || 
      product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  // Count products per category
  const getCategoryCount = (categoryId: string) => {
    return getProductsByCategory(categoryId).length;
  };

  return (
    <section id="produkty" className="relative overflow-hidden py-20 md:py-28 lg:py-32">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-bg-secondary via-bg-primary to-bg-primary pointer-events-none" />

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
            Katalog
          </span>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-text-primary mb-4">
            Nasze produkty
          </h2>
          <p className="text-lg text-text-secondary max-w-2xl mx-auto">
            Przeglądaj naszą ofertę profesjonalnego sprzętu. 
            Wszystkie urządzenia są regularnie serwisowane i gotowe do pracy.
          </p>
        </motion.div>

        {/* Filters Bar */}
        <motion.div
          variants={revealVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-50px' }}
          className="mb-8"
        >
          <div className="flex flex-col lg:flex-row gap-4 lg:items-center lg:justify-between">
            {/* Category Tabs */}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setActiveCategory(null)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  activeCategory === null
                    ? 'bg-gold text-bg-primary'
                    : 'bg-bg-card text-text-secondary hover:text-text-primary border border-border hover:border-gold/30'
                }`}
              >
                Wszystkie
                <span className="ml-2 text-xs opacity-70">({products.length})</span>
              </button>
              {categories.map((category) => (
                <button
                  key={category.id}
                  onClick={() => setActiveCategory(category.id)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                    activeCategory === category.id
                      ? 'bg-gold text-bg-primary'
                      : 'bg-bg-card text-text-secondary hover:text-text-primary border border-border hover:border-gold/30'
                  }`}
                >
                  {category.name}
                  <span className="ml-2 text-xs opacity-70">({getCategoryCount(category.id)})</span>
                </button>
              ))}
            </div>

            {/* Search & View Toggle */}
            <div className="flex gap-3">
              {/* Search */}
              <div className="relative flex-1 lg:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                <Input
                  type="text"
                  placeholder="Szukaj produktu..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* View Toggle */}
              <div className="flex bg-bg-card rounded-lg border border-border p-1">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2 rounded-md transition-colors ${
                    viewMode === 'grid' 
                      ? 'bg-gold/20 text-gold' 
                      : 'text-text-muted hover:text-text-primary'
                  }`}
                  aria-label="Widok siatki"
                >
                  <Grid3X3 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 rounded-md transition-colors ${
                    viewMode === 'list' 
                      ? 'bg-gold/20 text-gold' 
                      : 'text-text-muted hover:text-text-primary'
                  }`}
                  aria-label="Widok listy"
                >
                  <LayoutList className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Products Grid */}
        <AnimatePresence mode="wait">
          <motion.div
            key={`${activeCategory}-${searchQuery}`}
            variants={staggerContainerVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
            className={
              viewMode === 'grid'
                ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6'
                : 'flex flex-col gap-4'
            }
          >
            {filteredProducts.length > 0 ? (
              filteredProducts.map((product) => (
                <motion.div key={product.id} variants={staggerItemVariants}>
                  <ProductCard product={product} />
                </motion.div>
              ))
            ) : (
              <motion.div 
                variants={staggerItemVariants}
                className="col-span-full text-center py-16"
              >
                <div className="text-6xl mb-4">🔍</div>
                <h3 className="text-xl font-semibold text-text-primary mb-2">
                  Brak wyników
                </h3>
                <p className="text-text-secondary mb-4">
                  Nie znaleziono produktów pasujących do wyszukiwania.
                </p>
                <Button 
                  variant="secondary" 
                  onClick={() => {
                    setSearchQuery('');
                    setActiveCategory(null);
                  }}
                >
                  Wyczyść filtry
                </Button>
              </motion.div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Results count */}
        {filteredProducts.length > 0 && (
          <motion.p
            variants={revealVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="text-center text-text-muted mt-8"
          >
            Wyświetlono {filteredProducts.length} z {products.length} produktów
          </motion.p>
        )}
      </div>
    </section>
  );
}
