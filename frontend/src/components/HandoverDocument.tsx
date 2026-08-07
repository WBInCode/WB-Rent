import { Card } from '@/components/ui';
import type { HandoverSnapshot } from '@/services/adminApi';

const polishDate = (value: string) => {
  const [year, month, day] = value.slice(0, 10).split('-');
  return day && month && year ? `${day}.${month}.${year}` : value;
};

const okresNajmu = (rental: HandoverSnapshot['rental']) =>
  rental.isIndefinite || !rental.endDate
    ? `od ${polishDate(rental.startDate)} r., godz. ${rental.startTime} — najem bezterminowy, do odwołania`
    : `od ${polishDate(rental.startDate)} r., godz. ${rental.startTime} do ${polishDate(rental.endDate)} r., godz. ${rental.endTime}`;

const liczbaZdjec = () =>
  'zdjęcia stanu Sprzętu wykonane przy wydaniu, przechowywane w dokumentacji najmu';

function Wiersz({ etykieta, children }: { etykieta: string; children: React.ReactNode }) {
  return (
    <div className="grid sm:grid-cols-[170px_1fr] gap-1 sm:gap-4 py-1.5 border-b border-border last:border-0">
      <dt className="text-xs text-text-muted uppercase tracking-wide">{etykieta}</dt>
      <dd className="text-sm text-text-primary whitespace-pre-line">{children}</dd>
    </div>
  );
}

function Naglowek({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-xs uppercase tracking-wider text-gold font-semibold mt-6 first:mt-0 mb-2">{children}</h3>
  );
}

/**
 * Pełna treść protokołu do przeczytania przed złożeniem podpisu. Odpowiada
 * dokładnie temu, co znajdzie się w PDF — podpis pod dokumentem, którego się nie
 * widziało, byłby prawnie wadliwy.
 */
export function HandoverDocument({ snapshot }: { snapshot: HandoverSnapshot }) {
  return (
    <Card variant="glass" className="p-5 sm:p-7 bg-surface-soft">
      <div className="text-center pb-4 mb-5 border-b border-gold/30">
        <h2 className="text-lg sm:text-xl font-bold text-text-primary">PROTOKÓŁ WYDANIA SPRZĘTU</h2>
        <p className="text-sm text-text-muted mt-1">nr {snapshot.protocolNumber}</p>
        {snapshot.contractNumber && (
          <p className="text-xs text-text-muted">
            Załącznik nr 1 do umowy najmu nr {snapshot.contractNumber}
          </p>
        )}
      </div>

      <Naglowek>Strony</Naglowek>
      <dl>
        <Wiersz etykieta="Wynajmujący">
          {[
            snapshot.lessor.name,
            snapshot.lessor.address,
            snapshot.lessor.representative ? `wydający: ${snapshot.lessor.representative}` : '',
          ].filter(Boolean).join('\n')}
        </Wiersz>
        <Wiersz etykieta="Najemca">
          {[
            snapshot.renter.name,
            snapshot.renter.email ? `e-mail: ${snapshot.renter.email}` : '',
            snapshot.renter.phone ? `tel. ${snapshot.renter.phone}` : '',
          ].filter(Boolean).join('\n')}
        </Wiersz>
      </dl>

      <Naglowek>Przedmiot wydania</Naglowek>
      <dl>
        <Wiersz etykieta="Rezerwacja">nr {snapshot.rental.reservationId}</Wiersz>
        <Wiersz etykieta="Okres najmu">{okresNajmu(snapshot.rental)}</Wiersz>
        <Wiersz etykieta="Miejsce wydania">{snapshot.place}</Wiersz>
      </dl>

      <p className="text-sm font-semibold text-text-primary mt-4 mb-1.5">Wydany sprzęt i osprzęt:</p>
      <ol className="space-y-1 text-sm text-text-primary list-decimal list-inside marker:text-text-muted">
        {snapshot.items.map((pozycja, index) => <li key={index}>{pozycja}</li>)}
      </ol>

      {snapshot.accessories && snapshot.accessories.toLowerCase() !== 'brak' && (
        <dl className="mt-3">
          <Wiersz etykieta="Dodatkowe akcesoria">{snapshot.accessories}</Wiersz>
        </dl>
      )}

      <Naglowek>Stan sprzętu przy wydaniu</Naglowek>
      <p className="text-sm text-text-primary whitespace-pre-line">{snapshot.conditionNotes}</p>
      <dl className="mt-3">
        <Wiersz etykieta="Dokumentacja zdjęciowa">{liczbaZdjec()}</Wiersz>
      </dl>

      <Naglowek>Oświadczenia</Naglowek>
      <ol className="space-y-2 text-sm text-text-secondary list-decimal list-inside marker:text-text-muted">
        {snapshot.statements.map((tekst, index) => <li key={index}>{tekst}</li>)}
      </ol>
    </Card>
  );
}

export default HandoverDocument;
