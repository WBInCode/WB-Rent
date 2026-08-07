import { useState } from 'react';
import { AlertTriangle, Banknote, Check, CreditCard, Loader2 } from 'lucide-react';
import { markReservationPaid, type ManualPaymentMethod } from '@/services/adminApi';

interface ManualPaymentFormProps {
  reservationId: number;
  amount: number;
  onDone: (message: string, tone: 'success' | 'error') => void;
}

/** Przy ladzie klient płaci gotówką albo kartą — przelew idzie inną drogą. */
const METODY: Array<{ id: ManualPaymentMethod; etykieta: string; Ikona: typeof Banknote }> = [
  { id: 'cash', etykieta: 'Gotówka', Ikona: Banknote },
  { id: 'terminal', etykieta: 'Terminal', Ikona: CreditCard },
];

const money = (value: number) => `${value.toFixed(2).replace('.', ',')} zł`;

/**
 * Wpłata przyjęta poza bramką. Potwierdzenie jest świadome — zapis jest
 * nieodwracalny i natychmiast unieważnia link do płatności online.
 */
export function ManualPaymentForm({ reservationId, amount, onDone }: ManualPaymentFormProps) {
  const [otwarte, setOtwarte] = useState(false);
  const [metoda, setMetoda] = useState<ManualPaymentMethod>('cash');
  const [kwota, setKwota] = useState(String(amount));
  const [pracownik, setPracownik] = useState(() => localStorage.getItem('wb-rent-employee-name') || '');
  const [potwierdzone, setPotwierdzone] = useState(false);
  const [zapisywanie, setZapisywanie] = useState(false);

  const zapisz = async () => {
    setZapisywanie(true);
    const response = await markReservationPaid(reservationId, {
      method: metoda,
      amount: Number(kwota.replace(',', '.')),
      confirmedBy: pracownik.trim(),
    });
    onDone(
      response.message || (response.success ? 'Wpłata zapisana' : 'Nie udało się zapisać wpłaty'),
      response.success ? 'success' : 'error'
    );
    if (response.success) {
      localStorage.setItem('wb-rent-employee-name', pracownik.trim());
      setOtwarte(false);
      setPotwierdzone(false);
    }
    setZapisywanie(false);
  };

  if (!otwarte) {
    return (
      <button
        type="button"
        onClick={() => setOtwarte(true)}
        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-[--radius-sm] text-sm border border-border text-text-secondary hover:border-gold/40 hover:text-gold transition-colors"
      >
        <Banknote className="w-4 h-4" /> Opłacone na miejscu
      </button>
    );
  }

  const gotowe = potwierdzone && pracownik.trim().length >= 3 && Number(kwota.replace(',', '.')) > 0;

  return (
    <div className="w-full mt-3 p-4 rounded-[--radius-sm] bg-surface-soft border border-gold/25">
      <p className="text-sm font-semibold text-gold mb-3">Zapisz wpłatę przyjętą na miejscu</p>

      <div className="flex gap-2 mb-3">
        {METODY.map(({ id, etykieta, Ikona }) => (
          <button
            key={id}
            type="button"
            onClick={() => setMetoda(id)}
            className={`flex-1 inline-flex items-center justify-center gap-1.5 px-2 py-2 rounded-[--radius-sm] text-xs font-medium border transition-colors ${
              metoda === id ? 'bg-gold text-gold-contrast border-gold' : 'border-border text-text-secondary hover:border-gold/40'
            }`}
          >
            <Ikona className="w-3.5 h-3.5" /> {etykieta}
          </button>
        ))}
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <label className="block">
          <span className="block text-xs text-text-muted mb-1">Kwota (zł)</span>
          <input spellCheck={false}
            value={kwota}
            onChange={(event) => setKwota(event.target.value)}
            inputMode="decimal"
            className="w-full bg-bg-card border border-border rounded-[--radius-sm] px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-gold"
          />
        </label>
        <label className="block">
          <span className="block text-xs text-text-muted mb-1">Przyjmujący wpłatę</span>
          <input spellCheck={false}
            value={pracownik}
            onChange={(event) => setPracownik(event.target.value)}
            placeholder="Imię i nazwisko"
            className="w-full bg-bg-card border border-border rounded-[--radius-sm] px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-gold"
          />
        </label>
      </div>

      <label className="flex items-start gap-2.5 mt-4 p-3 rounded-[--radius-sm] bg-amber-500/[0.07] border border-amber-500/25 cursor-pointer">
        <input spellCheck={false}
          type="checkbox"
          checked={potwierdzone}
          onChange={(event) => setPotwierdzone(event.target.checked)}
          className="mt-0.5 w-4 h-4 accent-gold shrink-0"
        />
        <span className="text-xs text-amber-200/90 light:text-amber-800/90 leading-snug">
          <AlertTriangle className="inline w-3.5 h-3.5 mr-1 -mt-0.5" />
          Potwierdzam, że otrzymałem {money(Number(kwota.replace(',', '.')) || 0)}.
        </span>
      </label>

      <div className="flex gap-2 mt-4">
        <button
          type="button"
          disabled={!gotowe || zapisywanie}
          onClick={() => void zapisz()}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-[--radius-sm] text-sm font-medium bg-gold text-gold-contrast hover:bg-gold-light transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {zapisywanie ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          Zapisz wpłatę
        </button>
        <button
          type="button"
          onClick={() => { setOtwarte(false); setPotwierdzone(false); }}
          className="px-3 py-2 rounded-[--radius-sm] text-sm text-text-muted hover:text-text-primary transition-colors"
        >
          Anuluj
        </button>
      </div>
    </div>
  );
}

export default ManualPaymentForm;
