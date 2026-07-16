import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import { Button, Card, Badge } from '@/components/ui';

interface CalendarReservation {
  id: number;
  product_id: string;
  start_date: string;
  end_date: string;
  start_time?: string;
  end_time?: string;
  name: string;
  status: string;
}

interface Props {
  reservations: CalendarReservation[];
  productNames: Record<string, string>;
}

const MONTHS = [
  'Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec',
  'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień',
];
const WEEKDAYS = ['Pon', 'Wt', 'Śr', 'Czw', 'Pt', 'Sob', 'Nie'];
const ACTIVE_STATUSES = ['pending', 'confirmed', 'picked_up'];

const isoDate = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

const statusVariant = (status: string): 'warning' | 'success' | 'info' | 'default' => {
  if (status === 'pending') return 'warning';
  if (status === 'confirmed') return 'success';
  if (status === 'picked_up') return 'info';
  return 'default';
};

export function AdminAvailabilityCalendar({ reservations, productNames }: Props) {
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const active = useMemo(
    () => reservations.filter((reservation) => ACTIVE_STATUSES.includes(reservation.status)),
    [reservations]
  );

  const cells = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const mondayOffset = (first.getDay() + 6) % 7;
    const gridStart = new Date(first);
    gridStart.setDate(first.getDate() - mondayOffset);
    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(gridStart);
      date.setDate(gridStart.getDate() + index);
      const iso = isoDate(date);
      return {
        date,
        iso,
        currentMonth: date.getMonth() === month.getMonth(),
        reservations: active.filter((reservation) => reservation.start_date <= iso && reservation.end_date >= iso),
      };
    });
  }, [active, month]);

  const today = isoDate(new Date());

  return (
    <Card variant="glass" className="p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-gold" /> Kalendarz zajętości
          </h2>
          <p className="text-sm text-text-muted mt-1">Oczekujące, potwierdzone i aktualnie wydane urządzenia.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" aria-label="Poprzedni miesiąc" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button variant="secondary" size="sm" onClick={() => {
            const now = new Date();
            setMonth(new Date(now.getFullYear(), now.getMonth(), 1));
          }}>
            Dziś
          </Button>
          <Button variant="ghost" size="sm" aria-label="Następny miesiąc" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <h3 className="text-center text-lg font-semibold text-gold mb-4">
        {MONTHS[month.getMonth()]} {month.getFullYear()}
      </h3>

      <div className="overflow-x-auto pb-2">
        <div className="min-w-[850px]">
          <div className="grid grid-cols-7 border-b border-border">
            {WEEKDAYS.map((day, index) => (
              <div key={day} className={`px-2 py-2 text-center text-xs font-semibold ${index >= 5 ? 'text-gold' : 'text-text-muted'}`}>
                {day}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 border-l border-border">
            {cells.map((cell) => (
              <div
                key={cell.iso}
                className={`min-h-[130px] p-2 border-r border-b border-border ${
                  cell.currentMonth ? 'bg-bg-card/40' : 'bg-bg-primary/30 opacity-45'
                } ${cell.iso === today ? 'ring-1 ring-inset ring-gold' : ''}`}
              >
                <div className="flex justify-between items-center mb-2">
                  <span className={`text-xs font-semibold ${cell.iso === today ? 'text-gold' : 'text-text-muted'}`}>
                    {cell.date.getDate()}
                  </span>
                  {cell.reservations.length > 0 && (
                    <span className="text-[10px] text-text-muted">{cell.reservations.length}</span>
                  )}
                </div>
                <div className="space-y-1">
                  {cell.reservations.slice(0, 3).map((reservation) => (
                    <div
                      key={`${cell.iso}-${reservation.id}`}
                      title={`${productNames[reservation.product_id] || reservation.product_id} • ${reservation.name} • ${reservation.start_time || '09:00'}-${reservation.end_time || '09:00'}`}
                      className="p-1.5 rounded bg-bg-secondary border border-border text-[10px] leading-tight"
                    >
                      <div className="flex items-center gap-1 mb-1">
                        <Badge variant={statusVariant(reservation.status)} className="px-1.5 py-0 text-[9px]">
                          #{reservation.id}
                        </Badge>
                      </div>
                      <p className="text-text-primary font-medium truncate">
                        {productNames[reservation.product_id] || reservation.product_id}
                      </p>
                      <p className="text-text-muted truncate">{reservation.name}</p>
                    </div>
                  ))}
                  {cell.reservations.length > 3 && (
                    <p className="text-[10px] text-gold text-center">+{cell.reservations.length - 3} więcej</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}
