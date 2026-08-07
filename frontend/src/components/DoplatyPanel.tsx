import { useCallback, useEffect, useState } from 'react';
import { Check, Copy, Loader2, Plus, Receipt, Send } from 'lucide-react';
import { createSettlement, getSettlements, type Settlement } from '@/services/adminApi';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

interface DoplatyPanelProps {
  reservationId: number;
  onNotify?: (message: string, tone?: 'success' | 'error') => void;
}

const money = (value: number) => `${Number(value).toFixed(2).replace('.', ',')} zł`;

const OPIS_STATUSU: Record<string, { etykieta: string; klasa: string }> = {
  paid: { etykieta: 'Opłacona', klasa: 'text-emerald-400 light:text-emerald-700' },
  pending: { etykieta: 'Czeka na zapłatę', klasa: 'text-amber-400 light:text-amber-800' },
  cancelled: { etykieta: 'Anulowana', klasa: 'text-text-muted' },
  failed: { etykieta: 'Nieudana', klasa: 'text-red-400 light:text-red-700' },
};

/**
 * Dopłaty ustalone po zwrocie — koszt naprawy z faktury serwisu albo saldo
 * z protokołu. To osobna należność od czynszu najmu: własna kwota, własny link.
 */
export function DoplatyPanel({ reservationId, onNotify }: DoplatyPanelProps) {
  const [lista, setLista] = useState<Settlement[]>([]);
  const [ladowanie, setLadowanie] = useState(true);
  const [formularz, setFormularz] = useState(false);
  const [kwota, setKwota] = useState('');
  const [opis, setOpis] = useState('');
  const [wyslijMailem, setWyslijMailem] = useState(true);
  const [zapisywanie, setZapisywanie] = useState(false);
  const [skopiowany, setSkopiowany] = useState<string | null>(null);

  const wczytaj = useCallback(async () => {
    setLadowanie(true);
    const odpowiedz = await getSettlements(reservationId);
    setLista(odpowiedz.success && Array.isArray(odpowiedz.data) ? (odpowiedz.data as Settlement[]) : []);
    setLadowanie(false);
  }, [reservationId]);

  // Pobranie danych to synchronizacja z serwerem, a nie wyliczanie stanu z propsów.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void wczytaj(); }, [wczytaj]);

  const dodaj = async (event: React.FormEvent) => {
    event.preventDefault();
    setZapisywanie(true);
    const odpowiedz = await createSettlement(reservationId, {
      amount: Number(kwota.replace(',', '.')) || 0,
      label: opis.trim(),
      wyslijMailem,
    });
    onNotify?.(
      odpowiedz.message || (odpowiedz.success ? 'Dopłata przygotowana' : 'Nie udało się przygotować dopłaty'),
      odpowiedz.success ? 'success' : 'error'
    );
    if (odpowiedz.success) {
      setKwota('');
      setOpis('');
      setFormularz(false);
      void wczytaj();
    }
    setZapisywanie(false);
  };

  const kopiuj = async (link: string, sesja: string) => {
    await navigator.clipboard.writeText(link);
    setSkopiowany(sesja);
    setTimeout(() => setSkopiowany(null), 2000);
    onNotify?.('Link skopiowany do schowka', 'success');
  };

  return (
    <div className="p-4 bg-surface-soft border border-border rounded-[--radius-sm]">
      <div className="flex items-center justify-between gap-3 mb-3">
        <p className="flex items-center gap-2 text-text-primary font-medium">
          <Receipt className="w-4 h-4 text-gold-light light:text-gold-dark" />
          Dopłaty po rozliczeniu
        </p>
        {!formularz && (
          <Button variant="ghost" size="sm" onClick={() => setFormularz(true)}>
            <Plus className="w-4 h-4 mr-1" /> Dodaj
          </Button>
        )}
      </div>

      {ladowanie ? (
        <p className="text-sm text-text-muted flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Wczytywanie…
        </p>
      ) : lista.length === 0 && !formularz ? (
        <p className="text-sm text-text-muted">
          Brak dopłat. Dodaj tutaj koszt naprawy po otrzymaniu faktury z serwisu.
        </p>
      ) : (
        <div className="space-y-2">
          {lista.map((doplata) => {
            const stan = OPIS_STATUSU[doplata.status] || { etykieta: doplata.status, klasa: 'text-text-muted' };
            return (
              <div key={doplata.id} className="flex items-start justify-between gap-3 py-2 border-b border-border last:border-0">
                <div className="min-w-0">
                  <p className="text-sm text-text-primary truncate">{doplata.label || 'Dopłata'}</p>
                  <p className={`text-xs ${stan.klasa}`}>{stan.etykieta}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-sm font-semibold text-gold-light light:text-gold-dark tabular-nums">
                    {money(doplata.amount)}
                  </span>
                  {doplata.status === 'pending' && doplata.redirect_url && (
                    <button
                      type="button"
                      onClick={() => void kopiuj(doplata.redirect_url!, doplata.session_id)}
                      className="p-1.5 rounded text-text-muted hover:text-text-primary hover:bg-surface-strong transition-colors"
                      title="Skopiuj link do zapłaty"
                    >
                      {skopiowany === doplata.session_id
                        ? <Check className="w-4 h-4 text-emerald-400 light:text-emerald-700" />
                        : <Copy className="w-4 h-4" />}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {formularz && (
        <form onSubmit={dodaj} className="mt-3 pt-3 border-t border-border space-y-3">
          <div className="grid sm:grid-cols-[120px_1fr] gap-3">
            <Input
              label="Kwota (zł)"
              type="number"
              min="0.01"
              step="0.01"
              value={kwota}
              onChange={(e) => setKwota(e.target.value)}
              required
            />
            <Input
              label="Czego dotyczy"
              value={opis}
              onChange={(e) => setOpis(e.target.value)}
              placeholder="np. Naprawa turbiny — faktura serwisu ERPIX nr 123/2026"
              minLength={3}
              required
            />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              className="accent-gold"
              checked={wyslijMailem}
              onChange={(e) => setWyslijMailem(e.target.checked)}
            />
            <span className="text-sm text-text-secondary">Wyślij klientowi mailem z linkiem do zapłaty</span>
          </label>
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={zapisywanie}>
              {zapisywanie
                ? <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Przygotowuję…</>
                : <><Send className="w-4 h-4 mr-1.5" /> Przygotuj dopłatę</>}
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setFormularz(false)}>
              Anuluj
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

export default DoplatyPanel;
