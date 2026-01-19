import { useEffect, useState } from 'react';

interface UseScrollProgressOptions {
  threshold?: number;
}

export function useScrollProgress(options: UseScrollProgressOptions = {}) {
  const { threshold = 50 } = options;
  const [isScrolled, setIsScrolled] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      
      // Is scrolled past threshold
      setIsScrolled(scrollY > threshold);
      
      // Scroll progress (0-1)
      setScrollProgress(docHeight > 0 ? Math.min(scrollY / docHeight, 1) : 0);
    };

    // Check initial state
    handleScroll();

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [threshold]);

  return { isScrolled, scrollProgress };
}
