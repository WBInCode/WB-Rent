import { SitePage } from '@/components/SitePage';
import { Reservation } from '@/sections/Reservation';

export default function ReservationPage() {
  return (
    <SitePage
      title="Rezerwacja sprzętu online | WB-Rent"
      path="/rezerwacja"
      breadcrumb="Rezerwacja"
      description="Zarezerwuj sprzęt czyszczący online: wybierz urządzenie, termin i formę odbioru. Dostawa do 30 km od Rzeszowa."
    >
      <Reservation />
    </SitePage>
  );
}
