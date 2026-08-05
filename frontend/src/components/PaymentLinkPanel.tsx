import { useCallback, useEffect, useState } from 'react';
import { Check, Copy, CreditCard, ExternalLink, Loader2, Mail, RefreshCw } from 'lucide-react';
import { getPaymentLink, sendPaymentLink, type PaymentLinkInfo } from '@/services/adminApi';

interface PaymentLinkPanelProps {
  reservationId: number;
  onNotify?: (message: string, tone?: 'success' | 'error') => void;
}

const money = (value: number) => `${value.toFixed(2).replace('.', ',')} zł`;

/**
 * Link do płatności dla obsługi: skopiowanie, otwarcie i ponowna wysyłka mailem.
 * Backend zwraca zawsze tę samą sesję, więc klient nie zapłaci dwa razy.
 */
export function PaymentLinkPanel({ reservationId, onNotify }: PaymentLinkPanelProps) {
  const [info, setInfo] = useState<PaymentLinkInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const response = await getPaymentLink(reservationId);
    setInfo(
      response.success && response.data
        ? (response.data as PaymentLinkInfo)
        : { status: 'unavailable', reason: response.message || 'Nie udało się pobrać linku' }
    );
    setLoading(false);
  }, [reservationId]);

  useEffect(() => { void load(); }, [load]);

  const copy = async () => {
    if (info?.status !== 'ready') return;
    await navigator.clipboard.writeText(info.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    onNotify?.('Link skopiowany do schowka', 'success');
  };

  const send = async () => {
    setSending(true);
    const response = await sendPaymentLink(reservationId);
    onNotify?.(
      response.message || (response.success ? 'Link wysłany' : 'Nie udało się wysłać linku'),
      response.success ? 'success' : 'error'
    );
    setSending(false);
    void load();
  };

  return (
    <div className="p-4 bg-white/[0.025] border border-white/[0.08] rounded-[--radius-sm]">
      <div className="flex items-center justify-between gap-3 mb-3">
        <p className="text-text-muted flex items-center gap-2">
          <CreditCard className="w-4 h-4" /> Link do płatności
        </p>
        <button
          type="button"
          onClick={() => void load()}
          aria-label="Odśwież link do płatności"
          className="p-1.5 rounded text-text-muted hover:text-gold transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {loading && !info && (
        <p className="text-sm text-text-muted flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Sprawdzam…
        </p>
      )}

      {info?.status === 'paid' && (
        <p className="text-sm text-emerald-400 flex items-center gap-2">
          <Check className="w-4 h-4" /> Rezerwacja opłacona — link nie jest już aktywny.
        </p>
      )}

      {info?.status === 'unavailable' && (
        <p className="text-sm text-amber-400">{info.reason}</p>
      )}

      {info?.status === 'ready' && (
        <>
          <div className="flex items-baseline justify-between gap-3 mb-3">
            <span className="text-sm text-text-muted">Do zapłaty</span>
            <span className="text-lg font-bold text-gold">{money(info.amount)}</span>
          </div>

          <p className="text-[11px] font-mono text-text-muted break-all bg-black/30 rounded px-2 py-1.5 mb-3">
            {info.url}
          </p>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void copy()}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-[--radius-sm] text-sm bg-gold text-black font-medium hover:bg-gold-light transition-colors"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Skopiowano' : 'Kopiuj link'}
            </button>
            <a
              href={info.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-[--radius-sm] text-sm border border-border text-text-secondary hover:border-gold/40 hover:text-gold transition-colors"
            >
              <ExternalLink className="w-4 h-4" /> Otwórz
            </a>
            <button
              type="button"
              onClick={() => void send()}
              disabled={sending}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-[--radius-sm] text-sm border border-border text-text-secondary hover:border-gold/40 hover:text-gold transition-colors disabled:opacity-50"
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
              Wyślij mailem
            </button>
          </div>

          <p className="text-[11px] text-text-muted mt-3">
            {info.reused ? 'Ten sam link co poprzednio — klient nie zapłaci dwa razy.' : 'Nowy link płatności.'}
          </p>
        </>
      )}
    </div>
  );
}

export default PaymentLinkPanel;
