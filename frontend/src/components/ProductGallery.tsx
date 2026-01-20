import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, ZoomIn, X } from 'lucide-react';
import { Badge } from '@/components/ui';

interface ProductGalleryProps {
  images: string[];
  productName: string;
  available: boolean;
}

export function ProductGallery({ images, productName, available }: ProductGalleryProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isZoomed, setIsZoomed] = useState(false);

  // Ensure we have at least one image
  const galleryImages = images.length > 0 ? images : ['/products/placeholder.jpg'];
  const hasMultipleImages = galleryImages.length > 1;

  const handlePrevious = () => {
    setSelectedIndex((prev) => (prev === 0 ? galleryImages.length - 1 : prev - 1));
  };

  const handleNext = () => {
    setSelectedIndex((prev) => (prev === galleryImages.length - 1 ? 0 : prev + 1));
  };

  const handleThumbnailClick = (index: number) => {
    setSelectedIndex(index);
  };

  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    (e.target as HTMLImageElement).src = '/products/placeholder.jpg';
  };

  return (
    <>
      {/* Main Image Container */}
      <div className="relative aspect-square overflow-hidden bg-white group">
        <AnimatePresence mode="wait">
          <motion.img
            key={selectedIndex}
            src={galleryImages[selectedIndex]}
            alt={`${productName} - zdjęcie ${selectedIndex + 1}`}
            className="w-full h-full object-contain cursor-zoom-in p-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onError={handleImageError}
            onClick={() => setIsZoomed(true)}
          />
        </AnimatePresence>
        
        {/* Status Badge */}
        <div className="absolute top-4 right-4 z-10">
          <Badge variant={available ? 'success' : 'error'}>
            {available ? 'Dostępny' : 'Niedostępny'}
          </Badge>
        </div>

        {/* Zoom indicator */}
        <div className="absolute bottom-4 right-4 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => setIsZoomed(true)}
            className="p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
            aria-label="Powiększ zdjęcie"
          >
            <ZoomIn className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Arrows (only if multiple images) */}
        {hasMultipleImages && (
          <>
            <button
              onClick={handlePrevious}
              className="absolute left-2 top-1/2 -translate-y-1/2 z-10 p-2 rounded-full bg-black/50 text-white opacity-0 group-hover:opacity-100 hover:bg-black/70 transition-all"
              aria-label="Poprzednie zdjęcie"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={handleNext}
              className="absolute right-2 top-1/2 -translate-y-1/2 z-10 p-2 rounded-full bg-black/50 text-white opacity-0 group-hover:opacity-100 hover:bg-black/70 transition-all"
              aria-label="Następne zdjęcie"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </>
        )}

        {/* Image Counter */}
        {hasMultipleImages && (
          <div className="absolute bottom-4 left-4 z-10">
            <span className="px-3 py-1 rounded-full bg-black/50 text-white text-sm font-medium">
              {selectedIndex + 1} / {galleryImages.length}
            </span>
          </div>
        )}
      </div>

      {/* Thumbnails (only if multiple images) */}
      {hasMultipleImages && (
        <div className="mt-4 flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {galleryImages.map((image, index) => (
            <button
              key={index}
              onClick={() => handleThumbnailClick(index)}
              className={`
                relative flex-shrink-0 w-16 h-16 md:w-20 md:h-20 overflow-hidden 
                border-2 transition-all duration-200 bg-white
                ${selectedIndex === index 
                  ? 'border-gold' 
                  : 'border-border/50 hover:border-gold/50'
                }
              `}
              aria-label={`Zdjęcie ${index + 1}`}
            >
              <img
                src={image}
                alt={`${productName} - miniatura ${index + 1}`}
                className="w-full h-full object-contain p-1"
                onError={handleImageError}
              />
              {selectedIndex === index && (
                <motion.div
                  layoutId="thumbnail-indicator"
                  className="absolute inset-0 bg-gold/10"
                  transition={{ duration: 0.2 }}
                />
              )}
            </button>
          ))}
        </div>
      )}

      {/* Fullscreen Lightbox */}
      <AnimatePresence>
        {isZoomed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center"
            onClick={() => setIsZoomed(false)}
          >
            {/* Close button */}
            <button
              onClick={() => setIsZoomed(false)}
              className="absolute top-4 right-4 z-50 p-3 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
              aria-label="Zamknij"
            >
              <X className="w-6 h-6" />
            </button>

            {/* Navigation */}
            {hasMultipleImages && (
              <>
                <button
                  onClick={(e) => { e.stopPropagation(); handlePrevious(); }}
                  className="absolute left-4 top-1/2 -translate-y-1/2 z-50 p-3 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
                  aria-label="Poprzednie zdjęcie"
                >
                  <ChevronLeft className="w-8 h-8" />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleNext(); }}
                  className="absolute right-4 top-1/2 -translate-y-1/2 z-50 p-3 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
                  aria-label="Następne zdjęcie"
                >
                  <ChevronRight className="w-8 h-8" />
                </button>
              </>
            )}

            {/* Main Image */}
            <motion.div
              key={`zoomed-${selectedIndex}`}
              className="bg-white p-6 max-w-[90vw] max-h-[85vh] flex items-center justify-center"
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={galleryImages[selectedIndex]}
                alt={`${productName} - pełny rozmiar`}
                className="max-w-full max-h-[80vh] object-contain"
                onError={handleImageError}
              />
            </motion.div>

            {/* Counter */}
            {hasMultipleImages && (
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2">
                <span className="px-4 py-2 rounded-full bg-white/10 text-white text-sm font-medium">
                  {selectedIndex + 1} / {galleryImages.length}
                </span>
              </div>
            )}

            {/* Thumbnails in lightbox */}
            {hasMultipleImages && (
              <div className="absolute bottom-16 left-1/2 -translate-x-1/2 flex gap-2 max-w-[80vw] overflow-x-auto pb-2">
                {galleryImages.map((image, index) => (
                  <button
                    key={index}
                    onClick={(e) => { e.stopPropagation(); handleThumbnailClick(index); }}
                    className={`
                      flex-shrink-0 w-12 h-12 rounded-lg overflow-hidden border-2 transition-all
                      ${selectedIndex === index ? 'border-gold' : 'border-white/30 hover:border-white/50'}
                    `}
                  >
                    <img
                      src={image}
                      alt={`Miniatura ${index + 1}`}
                      className="w-full h-full object-cover"
                      onError={handleImageError}
                    />
                  </button>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
