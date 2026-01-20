import { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, X, Eye, Bell, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card, Badge, Button, Input } from '@/components/ui';
import { type Product } from '@/data/products';
import { hoverLiftVariants, transitions } from '@/lib/motion';
import { notifyWhenAvailable } from '@/services/api';

interface ProductCardProps {
  product: Product;
  isAvailable?: boolean; // Real-time availability from API
  onReserve?: (productId: string) => void;
}

export function ProductCard({ product, isAvailable, onReserve }: ProductCardProps) {
  // Use API availability if provided, otherwise fallback to static product.available
  const available = isAvailable !== undefined ? isAvailable : product.available;
  const [showNotifyModal, setShowNotifyModal] = useState(false);
  const [notifyEmail, setNotifyEmail] = useState('');
  const [notifyStatus, setNotifyStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [notifyMessage, setNotifyMessage] = useState('');

  const handleReserve = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Navigate to product page and scroll to reservation
    window.location.href = `/produkt/${product.id}#rezerwacja`;
  };

  const handleNotifyClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowNotifyModal(true);
    setNotifyStatus('idle');
    setNotifyMessage('');
  };

  const handleNotifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!notifyEmail) return;
    
    setNotifyStatus('loading');
    try {
      const result = await notifyWhenAvailable({
        productId: product.id,
        email: notifyEmail,
      });
      
      if (result.success) {
        setNotifyStatus('success');
        setNotifyMessage('Powiadomimy Cię gdy produkt będzie dostępny!');
        setTimeout(() => {
          setShowNotifyModal(false);
          setNotifyEmail('');
          setNotifyStatus('idle');
        }, 2000);
      } else {
        setNotifyStatus('error');
        setNotifyMessage(result.error?.message || 'Wystąpił błąd');
      }
    } catch {
      setNotifyStatus('error');
      setNotifyMessage('Wystąpił błąd. Spróbuj ponownie.');
    }
  };

  return (
    <motion.div
      variants={hoverLiftVariants}
      initial="rest"
      whileHover="hover"
      transition={transitions.spring}
      className="h-full"
    >
      <div className="h-full flex flex-col bg-bg-card border border-border/50 hover:border-gold/30 transition-all duration-300 group overflow-hidden">
        
        {/* Image - zachowane bez zmian */}
        <Link to={`/produkt/${product.id}`} className="block overflow-hidden">
          <div className="relative aspect-[4/3] overflow-hidden bg-white">
            {product.image ? (
              <img 
                src={product.image} 
                alt={product.name}
                className="w-full h-full object-contain p-4 group-hover:scale-105 transition-transform duration-500"
                loading="lazy"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <span className="text-4xl opacity-30">📦</span>
              </div>
            )}
            
            {/* Status */}
            {available ? (
              <div className="absolute top-0 right-0 bg-emerald-500 text-white text-[11px] font-bold px-3 py-1.5 flex items-center gap-1">
                <Check className="w-3 h-3" />
                DOSTĘPNY
              </div>
            ) : (
              <div className="absolute top-0 right-0 bg-red-500 text-white text-[11px] font-bold px-3 py-1.5 flex items-center gap-1">
                <X className="w-3 h-3" />
                WYPOŻYCZONY
              </div>
            )}

            {/* Hover overlay */}
            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
              <span className="flex items-center gap-2 text-white text-sm font-medium">
                <Eye className="w-4 h-4" />
                Zobacz szczegóły
              </span>
            </div>
          </div>
        </Link>

        {/* Content */}
        <div className="flex flex-col flex-1 p-5">
          <Link to={`/produkt/${product.id}`}>
            <h3 className="text-base font-semibold text-text-primary mb-2 line-clamp-2 hover:text-gold transition-colors">
              {product.name}
            </h3>
          </Link>
          
          <p className="text-sm text-text-muted mb-4 line-clamp-2 leading-relaxed">
            {product.description}
          </p>

          {/* Tags */}
          <div className="flex flex-wrap gap-2 mb-5">
            {product.features.slice(0, 3).map((feature) => (
              <span 
                key={feature}
                className="text-xs px-2.5 py-1 border border-gold/30 text-gold/80"
              >
                {feature}
              </span>
            ))}
          </div>

          <div className="flex-1" />

          {/* Price & Action */}
          <div className="flex items-center justify-between pt-4 border-t border-border/30">
            <div>
              <span className="text-2xl font-bold text-gold">{product.pricePerDay}</span>
              <span className="text-sm text-text-muted ml-1">zł/dzień</span>
            </div>
            {available ? (
              <Link
                to={`/produkt/${product.id}`}
                className="inline-flex items-center justify-center bg-gold hover:bg-gold-light text-black text-sm font-semibold px-5 py-2.5 transition-colors"
              >
                Rezerwuj
              </Link>
            ) : (
              <button
                onClick={handleNotifyClick}
                className="inline-flex items-center gap-2 text-sm text-text-secondary hover:text-gold border border-border/50 hover:border-gold/50 px-4 py-2 transition-colors"
              >
                <Bell className="w-4 h-4" />
                Powiadom
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Notify Modal - rendered via Portal */}
      {showNotifyModal && createPortal(
        <div 
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/70"
          onClick={() => setShowNotifyModal(false)}
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}
        >
          <div
            className="bg-bg-card border border-border p-6 w-full max-w-sm shadow-xl"
            onClick={(e) => e.stopPropagation()}
            style={{ position: 'relative' }}
          >
            {notifyStatus === 'success' ? (
              <div className="text-center py-6">
                <div className="w-14 h-14 bg-green-500/20 flex items-center justify-center mx-auto mb-4">
                  <Check className="w-7 h-7 text-green-500" />
                </div>
                <h3 className="text-lg font-bold text-text-primary mb-2">Zapisano!</h3>
                <p className="text-text-muted text-sm">{notifyMessage}</p>
              </div>
            ) : (
              <>
                <div className="text-center mb-5">
                  <div className="w-14 h-14 bg-gold/20 flex items-center justify-center mx-auto mb-4">
                    <Bell className="w-7 h-7 text-gold" />
                  </div>
                  <h3 className="text-lg font-bold text-text-primary mb-1">Powiadom mnie</h3>
                  <p className="text-sm text-text-muted">
                    Otrzymasz email gdy produkt będzie dostępny
                  </p>
                </div>

                <form onSubmit={handleNotifySubmit} className="space-y-4">
                  <Input
                    type="email"
                    placeholder="Twój adres email"
                    value={notifyEmail}
                    onChange={(e) => setNotifyEmail(e.target.value)}
                    required
                    disabled={notifyStatus === 'loading'}
                  />
                  
                  {notifyStatus === 'error' && (
                    <p className="text-red-500 text-sm text-center">{notifyMessage}</p>
                  )}

                  <div className="flex gap-3">
                    <Button
                      type="button"
                      variant="secondary"
                      className="flex-1"
                      onClick={() => setShowNotifyModal(false)}
                      disabled={notifyStatus === 'loading'}
                    >
                      Anuluj
                    </Button>
                    <Button
                      type="submit"
                      variant="primary"
                      className="flex-1"
                      disabled={notifyStatus === 'loading' || !notifyEmail}
                    >
                      {notifyStatus === 'loading' ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        'Zapisz się'
                      )}
                    </Button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>,
        document.body
      )}
    </motion.div>
  );
}
