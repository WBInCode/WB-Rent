import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, Send, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { Button, Input } from '@/components/ui';

const API_BASE = 'http://localhost:3001/api';

interface NewsletterSubscribeProps {
  variant?: 'inline' | 'card';
  className?: string;
}

export function NewsletterSubscribe({ variant = 'inline', className = '' }: NewsletterSubscribeProps) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [showName, setShowName] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email.trim()) {
      setStatus('error');
      setMessage('Podaj adres email');
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setStatus('error');
      setMessage('Nieprawidłowy adres email');
      return;
    }

    setStatus('loading');

    try {
      const res = await fetch(`${API_BASE}/newsletter/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email: email.trim(),
          name: name.trim() || undefined 
        }),
      });

      const data = await res.json();

      if (data.success) {
        setStatus('success');
        setMessage(data.message);
        setEmail('');
        setName('');
        setShowName(false);
      } else {
        setStatus('error');
        setMessage(data.message || 'Wystąpił błąd. Spróbuj ponownie.');
      }
    } catch (error) {
      setStatus('error');
      setMessage('Błąd połączenia. Spróbuj ponownie później.');
    }
  };

  if (variant === 'card') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className={`bg-gradient-to-br from-bg-card to-bg-primary border border-gold/20 rounded-2xl p-6 ${className}`}
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-lg bg-gold/10">
            <Bell className="w-6 h-6 text-gold" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-text-primary">Bądź na bieżąco!</h3>
            <p className="text-sm text-text-muted">Zapisz się do powiadomień o nowościach</p>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {status === 'success' ? (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="flex items-center gap-3 p-4 bg-green-500/10 border border-green-500/20 rounded-lg"
            >
              <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
              <p className="text-green-400 text-sm">{message}</p>
            </motion.div>
          ) : (
            <motion.form
              key="form"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onSubmit={handleSubmit}
              className="space-y-3"
            >
              <Input
                type="email"
                placeholder="Twój adres email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (status === 'error') setStatus('idle');
                }}
                onFocus={() => setShowName(true)}
              />
              
              <AnimatePresence>
                {showName && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                  >
                    <Input
                      type="text"
                      placeholder="Imię (opcjonalnie)"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </motion.div>
                )}
              </AnimatePresence>

              {status === 'error' && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-2 text-red-400 text-sm"
                >
                  <AlertCircle className="w-4 h-4" />
                  {message}
                </motion.div>
              )}

              <Button
                type="submit"
                variant="primary"
                className="w-full"
                disabled={status === 'loading'}
              >
                {status === 'loading' ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Zapisywanie...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    Zapisz się
                  </>
                )}
              </Button>

              <p className="text-xs text-text-muted text-center">
                Żadnego spamu. Tylko informacje o nowościach i promocjach.
              </p>
            </motion.form>
          )}
        </AnimatePresence>
      </motion.div>
    );
  }

  // Inline variant (for footer)
  return (
    <div className={className}>
      <div className="flex items-center gap-2 mb-3">
        <Bell className="w-4 h-4 text-gold" />
        <span className="text-sm font-medium text-text-primary">Newsletter</span>
      </div>

      <AnimatePresence mode="wait">
        {status === 'success' ? (
          <motion.div
            key="success"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-2 text-green-400 text-sm"
          >
            <CheckCircle className="w-4 h-4" />
            <span>Zapisano!</span>
          </motion.div>
        ) : (
          <motion.form
            key="form"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            onSubmit={handleSubmit}
            className="flex gap-2"
          >
            <input
              type="email"
              placeholder="Twój email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (status === 'error') setStatus('idle');
              }}
              className="flex-1 px-3 py-2 bg-bg-primary border border-border rounded-lg text-sm
                       text-text-primary placeholder:text-text-muted
                       focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold"
            />
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={status === 'loading'}
            >
              {status === 'loading' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </motion.form>
        )}
      </AnimatePresence>

      {status === 'error' && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-red-400 text-xs mt-2"
        >
          {message}
        </motion.p>
      )}
    </div>
  );
}
