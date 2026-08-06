import { Card } from '@/components/ui';
import type { ReturnSnapshot } from '@/services/adminApi';

const polishDate = (value: string) => {
  const [year, month, day] = value.slice(0, 10).split('-');
  return day && month && year ? `${day}.${month}.${year}` : value;
};

const money = (value: number) => `${value.toFixed(2).replace('.', ',')} zł`;

const okresNajmu = (rental: ReturnSnapshot['rental']) =>
  rental.isIndefinite || !rental.endDate
    ? `od ${polishDate(rental.startDate)} r., godz. ${rental.startTime} — najem bezterminowy`
    : `od ${polishDate(rental.startDate)} r., godz. ${rental.startTime} do ${polishDate(rental.endDate)} r., godz. ${rental.endTime}`;

const POZYCJE_LISTY: { klucz: keyof ReturnSnapshot['checklist']; etykieta: string }[] = [
  { klucz: 'complete', etykieta: 'Kompletny' },
  { klucz: 'working', etykieta: 'Sprawny' },
  { klucz: 'clean', etykieta: 'Czysty' },
  { klucz: 'undamaged', etykieta: 'Bez uszkodzeń' },
];

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

function Kwota({ opis, wartosc, pogrubione = false }: { opis: string; wartosc: string; pogrubione?: boolean }) {
  return (
    <div className={`flex justify-between gap-4 py-1.5 ${pogrubione ? 'font-semibold text-text-primary' : 'text-sm text-text-secondary'}`}>
      <span>{opis}</span>
      <span className="whitespace-nowrap tabular-nums">{wartosc}</span>
    </div>
  );
}

/**
 * Pełna treść protokołu zwrotu do przeczytania przed podpisem — odpowiada temu,
 * co znajdzie się w PDF.
 */
export function ReturnDocument({ snapshot }: { snapshot: ReturnSnapshot }) {
  return (
    <Card variant="glass" className="p-5 sm:p-7 bg-surface-soft">
      <div className="text-center pb-4 mb-5 border-b border-gold/30">
        <h2 className="text-lg sm:text-xl font-bold text-text-primary">PROTOKÓŁ ZWROTU SPRZĘTU</h2>
        <p className="text-sm text-text-muted mt-1">nr {snapshot.protocolNumber}</p>
        {snapshot.contractNumber && (
          <p className="text-xs text-text-muted">Załącznik nr 2 do umowy najmu nr {snapshot.contractNumber}</p>
        )}
      </div>

      <Naglowek>Strony</Naglowek>
      <dl>
        <Wiersz etykieta="Wynajmujący">
          {[
            snapshot.lessor.name,
            snapshot.lessor.address,
            snapshot.lessor.representative ? `przyjmujący zwrot: ${snapshot.lessor.representative}` : '',
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

      <Naglowek>Przedmiot zwrotu</Naglowek>
      <dl>
        <Wiersz etykieta="Rezerwacja">nr {snapshot.rental.reservationId}</Wiersz>
        <Wiersz etykieta="Okres najmu">{okresNajmu(snapshot.rental)}</Wiersz>
        <Wiersz etykieta="Miejsce zwrotu">{snapshot.place}</Wiersz>
        {snapshot.handoverProtocolNumber && (
          <Wiersz etykieta="Protokół wydania">nr {snapshot.handoverProtocolNumber}</Wiersz>
        )}
        {snapshot.overdueDays > 0 && (
          <Wiersz etykieta="Opóźnienie zwrotu">
            {snapshot.overdueDays} rozpoczętych dób ponad termin
          </Wiersz>
        )}
      </dl>

      <p className="text-sm font-semibold text-text-primary mt-4 mb-1.5">Zwrócony sprzęt i osprzęt:</p>
      <ol className="space-y-1 text-sm text-text-primary list-decimal list-inside marker:text-text-muted">
        {snapshot.items.map((pozycja, index) => <li key={index}>{pozycja}</li>)}
      </ol>

      <Naglowek>Ocena stanu przy zwrocie</Naglowek>
      <ul className="space-y-1 text-sm">
        {POZYCJE_LISTY.map(({ klucz, etykieta }) => {
          const spelniony = snapshot.checklist[klucz];
          return (
            <li key={klucz} className={spelniony ? 'text-text-primary' : 'text-amber-400 light:text-amber-800 font-medium'}>
              {spelniony ? '✓' : '✗'} {etykieta}{spelniony ? '' : ' — NIE'}
            </li>
          );
        })}
      </ul>

      <dl className="mt-3">
        <Wiersz etykieta="Stan przy wydaniu">{snapshot.conditionAtHandover || '—'}</Wiersz>
      </dl>
      <p className="text-sm font-semibold text-text-primary mt-3 mb-1">Uwagi przy zwrocie:</p>
      <p className="text-sm text-text-primary whitespace-pre-line">{snapshot.conditionNotes || 'Brak uwag.'}</p>
      <dl className="mt-3">
        <Wiersz etykieta="Dokumentacja zdjęciowa">
          zdjęcia stanu Sprzętu wykonane przy zwrocie, przechowywane w dokumentacji najmu
        </Wiersz>
      </dl>

      <Naglowek>Rozliczenie</Naglowek>
      {snapshot.charges.length === 0 ? (
        <p className="text-sm text-text-secondary">Nie stwierdzono podstaw do naliczenia jakichkolwiek należności.</p>
      ) : (
        <>
          {snapshot.charges.map((pozycja, index) => (
            <Kwota
              key={index}
              opis={pozycja.note ? `${pozycja.label} — ${pozycja.note}` : pozycja.label}
              wartosc={pozycja.amount === null ? 'do wyceny' : money(pozycja.amount)}
            />
          ))}
          <div className="border-t border-border mt-2 pt-2">
            <Kwota opis="Razem należności" wartosc={money(snapshot.chargesTotal)} pogrubione />
          </div>
        </>
      )}
      <Kwota opis="Kaucja wpłacona" wartosc={money(snapshot.deposit)} />
      <div className="border-t border-border mt-2 pt-2">
        <Kwota
          opis={snapshot.balance > 0 ? 'Do dopłaty przez Najemcę' : snapshot.balance < 0 ? 'Do zwrotu Najemcy z kaucji' : 'Do rozliczenia'}
          wartosc={money(Math.abs(snapshot.balance))}
          pogrubione
        />
      </div>
      {snapshot.hasPendingValuation && (
        <p className="text-xs text-text-muted mt-2">
          Kwoty oznaczone jako „do wyceny" zostaną wskazane po otrzymaniu faktury z autoryzowanego serwisu
          i doliczone do powyższego rozliczenia.
        </p>
      )}

      <Naglowek>Oświadczenia</Naglowek>
      <ol className="space-y-2 text-sm text-text-secondary list-decimal list-inside marker:text-text-muted">
        {snapshot.statements.map((tekst, index) => <li key={index}>{tekst}</li>)}
      </ol>
    </Card>
  );
}

export default ReturnDocument;
