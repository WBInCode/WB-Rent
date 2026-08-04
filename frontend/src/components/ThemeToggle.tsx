import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../hooks/useTheme';

interface ThemeToggleProps {
  className?: string;
}

export default function ThemeToggle({ className = '' }: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme();
  const isLight = theme === 'light';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      role="switch"
      aria-checked={isLight}
      aria-label={isLight ? 'Włącz motyw ciemny' : 'Włącz motyw jasny'}
      title={isLight ? 'Motyw ciemny' : 'Motyw jasny'}
      className={`relative inline-flex h-10 w-10 items-center justify-center rounded-[--radius-sm] border border-border text-text-secondary transition-colors duration-[--duration-fast] hover:border-gold/40 hover:text-gold ${className}`}
    >
      <Sun
        size={17}
        strokeWidth={2}
        aria-hidden="true"
        className={`absolute transition-all duration-[--duration-normal] ${
          isLight ? 'rotate-0 scale-100 opacity-100' : '-rotate-90 scale-50 opacity-0'
        }`}
      />
      <Moon
        size={17}
        strokeWidth={2}
        aria-hidden="true"
        className={`absolute transition-all duration-[--duration-normal] ${
          isLight ? 'rotate-90 scale-50 opacity-0' : 'rotate-0 scale-100 opacity-100'
        }`}
      />
    </button>
  );
}
