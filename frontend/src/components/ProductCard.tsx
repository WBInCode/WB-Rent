import { motion } from 'framer-motion';
import { Check, X } from 'lucide-react';
import { Card, Badge, Button } from '@/components/ui';
import { type Product } from '@/data/products';
import { hoverLiftVariants, transitions } from '@/lib/motion';

interface ProductCardProps {
  product: Product;
  onReserve?: (productId: string) => void;
}

export function ProductCard({ product, onReserve }: ProductCardProps) {
  const handleReserve = () => {
    if (onReserve) {
      onReserve(product.id);
    } else {
      // Default: scroll to reservation section
      document.getElementById('rezerwacja')?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <motion.div
      variants={hoverLiftVariants}
      initial="rest"
      whileHover="hover"
      transition={transitions.spring}
    >
      <Card 
        variant="glass" 
        padding="none"
        className="h-full flex flex-col overflow-hidden group"
      >
        {/* Image placeholder */}
        <div className="relative h-48 bg-gradient-to-br from-bg-primary to-bg-card overflow-hidden">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-24 h-24 rounded-2xl bg-gold/10 flex items-center justify-center">
              <span className="text-4xl text-gold/50">📦</span>
            </div>
          </div>
          
          {/* Status badge */}
          <div className="absolute top-3 right-3">
            <Badge 
              variant={product.available ? 'success' : 'error'}
              size="sm"
              icon={product.available ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
            >
              {product.available ? 'Dostępny' : 'Wypożyczony'}
            </Badge>
          </div>

          {/* Hover overlay */}
          <div className="absolute inset-0 bg-gold/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        </div>

        {/* Content */}
        <div className="flex flex-col flex-1 p-5">
          {/* Title & Description */}
          <h3 className="text-lg font-semibold text-text-primary mb-2 group-hover:text-gold transition-colors duration-200">
            {product.name}
          </h3>
          <p className="text-sm text-text-secondary mb-4 line-clamp-2">
            {product.description}
          </p>

          {/* Features */}
          <div className="flex flex-wrap gap-2 mb-4">
            {product.features.map((feature) => (
              <span 
                key={feature}
                className="text-xs px-2 py-1 rounded-md bg-bg-primary/80 text-text-muted border border-border"
              >
                {feature}
              </span>
            ))}
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Price & CTA */}
          <div className="flex items-center justify-between pt-4 border-t border-border">
            <div>
              <span className="text-2xl font-bold text-gold">{product.pricePerDay}</span>
              <span className="text-sm text-text-muted ml-1">zł/dzień</span>
            </div>
            <Button 
              variant={product.available ? 'primary' : 'secondary'}
              size="sm"
              onClick={handleReserve}
              disabled={!product.available}
            >
              {product.available ? 'Rezerwuj' : 'Powiadom'}
            </Button>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}
