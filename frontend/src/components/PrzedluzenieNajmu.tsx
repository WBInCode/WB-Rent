import { useState } from 'react';
import { CalendarPlus, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { DatePicker } from '@/components/ui/DatePicker';
import { quoteExtension, startExtension, type ExtensionQuote } from '@/services/api';

interface PrzedluzenieNajmuProps {
  reservationId: number;
  token: string;
  obecnyKoniec: string;
  onClose: () => void;
}

const zloty = (kwota: number) => `${kwota.toFixed(2).replace('.', ',')} zł`;

/**
 * Przedłużenie najmu przez klienta.
 *
 * Umowa (§5 ust. 3) wymaga zapłaty z góry, więc aneks pokazujemy z kwotą,
 * a najem przedłuża się dopiero po zaksięgowaniu wpłaty.
 */
export function PrzedluzenieNajmu({ reservationId, token, obecnyKoniec, onClose }: PrzedluzenieNajmuProps) {
  const [nowaData, setNowaData] = useState('');
  const [wycena, setWycena] = useState<ExtensionQuote | null>(null);
  const [blad, setBlad] = useState<string | null>(null);
  const [pracuje, setPracuje] = useState(false);

  const minimalnaData = (() => {
    const d = new Date(`${obecnyKoniec}T12:00:00`);
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  })();

  const wycen = async (data: string) => {
    setNowaData(data);
    setWycena(null);
    setBlad(null);
    if (!data) return;
    setPracuje(true);
    const wynik = await quoteExtension(reservationId, token, data);
    if (wynik.success && wynik.data) setWycena(wynik.data);
    else setBlad(wynik.error?.message || 'Nie udało się wycenić przedłużenia');
    setPracuje(false);
  };

  const zaplac = async () => {
    setPracuje(true);
    setBlad(null);
    const wynik = await startExtension(reservationId, token, nowaData);
    if (wynik.success && wynik.data?.redirectUrl) {
      window.location.assign(wynik.data.redirectUrl);
      return;
    }
    setBlad(wynik.error?.message || 'Nie udało się rozpocząć przedłużenia');
    setPracuje(false);
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[90] p-4">
      <Card variant="glass" className="w-full max-w-md p-6">
        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            <p className="text-xs uppercase text-gold-light light:text-gold-dark font-semibold">Rezerwacja #{reservationId}</p>
            <h2 className="text-xl font-bold text-text-primary mt-1">Przedłuż najem</h2>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Zamknij">
            <X className="w-5 h-5" />
          </Button>
        </div>

        <div className="mb-4">
          <DatePicker
            label="Do kiedy potrzebujesz sprzętu?"
            minDate={minimalnaData}
            value={nowaData}
            onChange={(value) => void wycen(value)}
          />
        </div>

        {pracuje && !wycena && (
          <p className="text-sm text-text-muted flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Liczę dopłatę…
          </p>
        )}

        {blad && (
          <div className="p-3 rounded-lg bg-error/10 border border-error/20 text-sm text-error">{blad}</div>
        )}

        {wycena && (
          <div className="space-y-3">
            <div className="p-4 rounded-lg bg-surface-soft border border-border space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-text-secondary">Nowy termin zwrotu</span>
                <span className="text-text-primary capitalize">{wycena.nowyTermin?.dzienTygodnia}, {wycena.nowyTermin?.dataSlownie}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-secondary">Najem po zmianie</span>
                <span className="text-text-primary">{wycena.dni} dób — {zloty(wycena.nowaKwota)}</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-border font-semibold">
                <span className="text-text-primary">Do dopłaty teraz</span>
                <span className="text-gold-light light:text-gold-dark">{zloty(wycena.doplata)}</span>
              </div>
            </div>

            <p className="text-xs text-text-muted">
              Najem przedłuża się z chwilą zaksięgowania wpłaty. Na płatność masz 60 minut —
              przez ten czas sprzęt jest dla Ciebie zarezerwowany.
            </p>

            <Button variant="primary" className="w-full" disabled={pracuje} onClick={() => void zaplac()}>
              {pracuje
                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Przygotowuję płatność…</>
                : <><CalendarPlus className="w-4 h-4 mr-2" /> Zapłać {zloty(wycena.doplata)} i przedłuż</>}
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}

export default PrzedluzenieNajmu;
