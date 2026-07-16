import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, XCircle, Clock, Loader2, ArrowLeft, RefreshCw } from 'lucide-react';
import { Card, Button } from '@/components/ui';
import { getPaymentStatus, type PaymentStatusResponse } from '@/services/api';

type ViewState = 'loading' | 'paid' | 'pending' | 'failed' | 'cancelled' | 'notfound';

const POLL_INTERVAL_MS = 3000;
const MAX_POLLS = 40; // ~2 min

/** Strona powrotu z bramki płatności: /platnosc?sesja=<sessionId> */
export function PaymentReturnPage() {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('sesja') || '';
  const [state, setState] = useState<ViewState>(() => (sessionId ? 'loading' : 'notfound'));
  const [payment, setPayment] = useState<PaymentStatusResponse | null>(null);
  const pollCount = useRef(0);

  useEffect(() => {
    if (!sessionId) return;

    let timeoutId: ReturnType<typeof setTimeout>;
    let stopped = false;

    const poll = async () => {
      const result = await getPaymentStatus(sessionId);
      if (stopped) return;

      if (!result.success || !result.data) {
        setState('notfound');
        return;
      }

      setPayment(result.data);

      switch (result.data.status) {
        case 'paid':
          setState('paid');
          return;
        case 'failed':
          setState('failed');
          return;
        case 'cancelled':
          setState('cancelled');
          return;
        default:
          // pending - keep polling (webhook may arrive with a delay)
          pollCount.current += 1;
          if (pollCount.current >= MAX_POLLS) {
            setState('pending');
            return;
          }
          setState('loading');
          timeoutId = setTimeout(poll, POLL_INTERVAL_MS);
      }
    };

    poll();
    return () => {
      stopped = true;
      clearTimeout(timeoutId);
    };
  }, [sessionId]);

  const content = () => {
    switch (state) {
      case 'loading':
        return (
          <>
            <Loader2 className="w-16 h-16 text-gold animate-spin mx-auto mb-6" />
            <h1 className="text-2xl font-bold text-text-primary mb-2">Sprawdzamy status płatności…</h1>
            <p className="text-text-secondary">
              Czekamy na potwierdzenie od operatora płatności. To może potrwać kilkanaście sekund.
            </p>
          </>
        );
      case 'paid':
        return (
          <>
            <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-6" />
            <h1 className="text-2xl font-bold text-text-primary mb-2">Płatność przyjęta!</h1>
            <p className="text-text-secondary">
              Dziękujemy — rezerwacja #{payment?.reservationId} została opłacona
              {payment ? ` (${payment.amount} zł)` : ''}. Potwierdzenie wyślemy na Twój e-mail.
            </p>
          </>
        );
      case 'pending':
        return (
          <>
            <Clock className="w-16 h-16 text-gold mx-auto mb-6" />
            <h1 className="text-2xl font-bold text-text-primary mb-2">Płatność w trakcie przetwarzania</h1>
            <p className="text-text-secondary">
              Nie otrzymaliśmy jeszcze potwierdzenia. Jeśli środki zostały pobrane, status
              zaktualizuje się automatycznie — sprawdź ponownie za kilka minut.
            </p>
            <Button variant="secondary" className="mt-6" onClick={() => window.location.reload()}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Sprawdź ponownie
            </Button>
          </>
        );
      case 'failed':
      case 'cancelled':
        return (
          <>
            <XCircle className="w-16 h-16 text-red-500 mx-auto mb-6" />
            <h1 className="text-2xl font-bold text-text-primary mb-2">
              {state === 'failed' ? 'Płatność nie powiodła się' : 'Płatność anulowana'}
            </h1>
            <p className="text-text-secondary">
              Twoja rezerwacja #{payment?.reservationId} jest nadal zapisana — możesz zapłacić
              przy odbiorze lub skontaktować się z nami, aby ponowić płatność online.
            </p>
          </>
        );
      case 'notfound':
        return (
          <>
            <XCircle className="w-16 h-16 text-red-500 mx-auto mb-6" />
            <h1 className="text-2xl font-bold text-text-primary mb-2">Nie znaleziono płatności</h1>
            <p className="text-text-secondary">
              Link jest nieprawidłowy lub wygasł. Jeśli dokonałeś płatności, skontaktuj się z nami.
            </p>
          </>
        );
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <Card variant="glass" className="max-w-md w-full p-8 text-center">
        {content()}
        <Link to="/" className="inline-block mt-8">
          <Button variant="ghost">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Wróć na stronę główną
          </Button>
        </Link>
      </Card>
    </div>
  );
}

export default PaymentReturnPage;
