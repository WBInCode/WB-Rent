import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import {
  Mail,
  Calendar,
  Package,
  Loader2,
  CheckCircle2,
  XCircle,
  CreditCard,
  Ban,
  Check,
} from 'lucide-react';
import { Button, Card, Badge, Input } from '@/components/ui';
import { UtilityPageShell } from '@/components/UtilityPageShell';
import { opiszEtapDlaKlienta, type StageTone } from '@/utils/rentalStage';
import {
  requestMyReservationsLink,
  getMyReservations,
  cancelMyReservation,
  createPayment,
  getPaymentConfig,
  type MyReservation,
} from '@/services/api';

const TON_PLAKIETKI: Record<StageTone, 'warning' | 'success' | 'error' | 'default' | 'info'> = {
  neutral: 'default',
  info: 'info',
  warning: 'warning',
  success: 'success',
  error: 'error',
  alert: 'error',
};

export function MyReservationsPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';

  // Request-link form state
  const [email, setEmail] = useState('');
  const [requestState, setRequestState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [requestMessage, setRequestMessage] = useState('');

  // Reservation list state
  const [listState, setListState] = useState<'idle' | 'loading' | 'ready' | 'unauthorized'>(
    () => (token ? 'loading' : 'idle')
  );
  const [reservations, setReservations] = useState<MyReservation[]>([]);
  const [ownerEmail, setOwnerEmail] = useState('');
  const [paymentsEnabled, setPaymentsEnabled] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    getMyReservations(token).then((result) => {
      if (cancelled) return;
      if (result.success && result.data) {
        setReservations(result.data.data);
        setOwnerEmail(result.data.email);
        setListState('ready');
      } else {
        setListState('unauthorized');
      }
    });
    return () => {
      cancelled = true;
    };
  }, [token, reloadKey]);

  useEffect(() => {
    getPaymentConfig().then((r) => {
      if (r.success && r.data) setPaymentsEnabled(r.data.enabled);
    });
  }, []);

  const handleRequestLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setRequestState('sending');
    const result = await requestMyReservationsLink(email.trim());
    if (result.success) {
      setRequestState('sent');
      setRequestMessage(
        (result.data as { message?: string })?.message ||
          'Jeśli ten adres ma rezerwacje, wysłaliśmy na niego link dostępu.'
      );
    } else {
      setRequestState('error');
      setRequestMessage(result.error?.message || 'Wystąpił błąd. Spróbuj ponownie.');
    }
  };

  const handleCancel = async (id: number) => {
    if (!window.confirm('Czy na pewno chcesz anulować tę rezerwację?')) return;
    setBusyId(id);
    setActionMessage(null);
    const result = await cancelMyReservation(id, token);
    setActionMessage(
      result.success ? 'Rezerwacja anulowana.' : result.error?.message || 'Nie udało się anulować.'
    );
    setReloadKey((k) => k + 1);
    setBusyId(null);
  };

  const handlePay = async (id: number) => {
    setBusyId(id);
    setActionMessage(null);
    const result = await createPayment(id, ownerEmail);
    if (result.success && result.data?.redirectUrl) {
      window.location.assign(result.data.redirectUrl);
      return;
    }
    setActionMessage(result.error?.message || 'Nie udało się utworzyć płatności.');
    setBusyId(null);
  };

  // Anulowanie i zaplate rozstrzyga serwer. Wczesniej przycisk "Opłać" pokazywal
  // sie takze przed podpisaniem umowy i konczyl bledem bez wyjscia, a "Anuluj"
  // pozwalal klientowi skasowac podpisany i oplacony najem jednym klikiem.
  const canCancel = (r: MyReservation) => !r.cancelBlockedReason;

  const canPay = (r: MyReservation) => paymentsEnabled && Boolean(r.canPayOnline);

  return (
    <UtilityPageShell maxWidth="3xl">
        <div className="mb-7">
          <span className="section-kicker"><Calendar className="w-3.5 h-3.5" aria-hidden="true" /> Strefa klienta</span>
          <h1 className="text-3xl sm:text-4xl font-bold text-text-primary mt-3">Moje rezerwacje</h1>
          <p className="text-text-secondary mt-2">Bezpieczny dostęp bez zakładania konta.</p>
        </div>

        {/* --- No token: request-link form --- */}
        {!token && (
          <Card variant="glass" className="p-8 mt-6">
            {requestState === 'sent' ? (
              <div className="text-center py-6">
                <CheckCircle2 className="w-14 h-14 text-green-500 mx-auto mb-4" />
                <h2 className="text-xl font-semibold text-text-primary mb-2">Sprawdź skrzynkę</h2>
                <p className="text-text-secondary">{requestMessage}</p>
              </div>
            ) : (
              <>
                <p className="text-text-secondary mb-6">
                  Podaj adres e-mail użyty przy rezerwacji — wyślemy Ci link dostępu
                  (bez zakładania konta, ważny 24 godziny).
                </p>
                <form onSubmit={handleRequestLink} className="flex flex-col sm:flex-row gap-3">
                  <div className="flex-1">
                    <Input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="twoj@email.pl"
                      aria-label="Adres e-mail"
                      required
                    />
                  </div>
                  <Button type="submit" variant="primary" disabled={requestState === 'sending'}>
                    {requestState === 'sending' ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Mail className="w-4 h-4 mr-2" />
                    )}
                    Wyślij link
                  </Button>
                </form>
                {requestState === 'error' && (
                  <p className="text-red-400 text-sm mt-3">{requestMessage}</p>
                )}
              </>
            )}
          </Card>
        )}

        {/* --- Token: reservation list --- */}
        {token && listState === 'loading' && (
          <div className="flex justify-center py-20">
            <Loader2 className="w-10 h-10 text-gold animate-spin" />
          </div>
        )}

        {token && listState === 'unauthorized' && (
          <Card variant="glass" className="p-8 mt-6 text-center">
            <XCircle className="w-14 h-14 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-text-primary mb-2">Link wygasł</h2>
            <p className="text-text-secondary mb-6">
              Link dostępu jest nieprawidłowy lub stracił ważność (24h).
            </p>
            <Link to="/moje-rezerwacje">
              <Button variant="primary">Poproś o nowy link</Button>
            </Link>
          </Card>
        )}

        {token && listState === 'ready' && (
          <div className="mt-6 space-y-4">
            <p className="text-text-secondary text-sm">
              Rezerwacje dla: <span className="text-gold">{ownerEmail}</span>
            </p>

            {actionMessage && (
              <div className="p-3 rounded-lg bg-gold/10 border border-gold/30 text-sm text-text-primary">
                {actionMessage}
              </div>
            )}

            {reservations.length === 0 ? (
              <Card variant="glass" className="p-8 text-center">
                <Package className="w-12 h-12 text-text-muted mx-auto mb-4" />
                <p className="text-text-secondary">Brak rezerwacji dla tego adresu.</p>
              </Card>
            ) : (
              reservations.map((r) => {
                const etap = opiszEtapDlaKlienta(r.stage);
                return (
                <Card key={r.id} variant="glass" className="p-5">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-2">
                        <Badge variant={TON_PLAKIETKI[etap.ton]}>
                          {etap.etykieta}
                        </Badge>
                        {r.payment_status === 'paid' && (
                          <Badge variant="success"><Check className="w-3 h-3" aria-hidden="true" /> Opłacona</Badge>
                        )}
                        <span className="text-xs text-text-muted">#{r.id}</span>
                      </div>
                      <h3 className="font-semibold text-text-primary">
                        {(r.items?.length || 0) > 1 ? `Zestaw ${r.items!.length} urządzeń` : r.productName}
                      </h3>
                      {(r.items?.length || 0) > 1 && (
                        <ul className="mt-2 space-y-1 text-xs text-text-secondary">
                          {r.items!.map((item) => <li key={item.product_id}>• {item.productName}</li>)}
                        </ul>
                      )}
                      <div className="flex flex-wrap gap-4 mt-1 text-sm text-text-secondary">
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="w-4 h-4 text-gold" />
                          {r.start_date} → {r.is_indefinite
                            ? 'bezterminowo'
                            : `${r.end_date} (${r.days} ${r.days === 1 ? 'doba' : r.days < 5 ? 'doby' : 'dób'})`}
                        </span>
                        <span className="font-medium text-gold">{r.total_price} zł</span>
                      </div>
                      {etap.wskazowka && (
                        <p className="text-sm text-text-muted mt-2">{etap.wskazowka}</p>
                      )}
                      {r.cancelBlockedReason?.includes('skontaktuj') && (
                        <p className="text-xs text-text-muted mt-1">
                          Rezygnacja: {r.cancelBlockedReason.split('—')[1]?.trim() || r.cancelBlockedReason}
                        </p>
                      )}
                    </div>

                    <div className="flex gap-2 shrink-0">
                      {canPay(r) && (
                        <Button
                          variant="primary"
                          size="sm"
                          disabled={busyId === r.id}
                          onClick={() => handlePay(r.id)}
                        >
                          {busyId === r.id ? (
                            <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                          ) : (
                            <CreditCard className="w-4 h-4 mr-1.5" />
                          )}
                          Opłać
                        </Button>
                      )}
                      {canCancel(r) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={busyId === r.id}
                          onClick={() => handleCancel(r.id)}
                          className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                        >
                          <Ban className="w-4 h-4 mr-1.5" />
                          Anuluj
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
                );
              })
            )}
          </div>
        )}
    </UtilityPageShell>
  );
}

export default MyReservationsPage;
