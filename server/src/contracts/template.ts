export const CONTRACT_TEMPLATE_VERSION = '1.0.0';

export interface ContractSnapshot {
  contractNumber: string;
  templateVersion: string;
  generatedAt: string;
  lessor: {
    name: string;
    address: string;
    nip: string;
    representative: string;
  };
  renter: {
    name: string;
    email: string;
    phone: string;
    address: string;
    documentType: 'dowod_osobisty' | 'paszport';
    documentNumber: string;
    pesel?: string;
  };
  rental: {
    reservationId: number;
    productId: string;
    productName: string;
    startDate: string;
    endDate: string;
    startTime: string;
    endTime: string;
    days: number;
    totalPrice: number;
    deposit: number;
    delivery: boolean;
    deliveryAddress?: string;
    accessories: string;
    conditionNotes: string;
  };
  clauses: Array<{ number: number; title: string; text: string }>;
}

export const contractClauses = [
  { number: 1, title: 'Przedmiot umowy', text: 'Wynajmujący oddaje Najemcy do czasowego używania sprzęt wskazany w umowie wraz z opisanymi akcesoriami. Najemca potwierdza zgodność danych sprzętu i jego stan przy wydaniu.' },
  { number: 2, title: 'Okres najmu i wynagrodzenie', text: 'Najem trwa w terminie wskazanym w umowie. Najemca zobowiązuje się zapłacić czynsz najmu oraz kaucję w podanej wysokości. Przedłużenie wymaga uprzedniej zgody Wynajmującego.' },
  { number: 3, title: 'Zasady użytkowania', text: 'Najemca będzie używał sprzętu zgodnie z przeznaczeniem, instrukcją producenta i zasadami bezpieczeństwa. Zabronione jest oddawanie sprzętu osobom trzecim, dokonywanie napraw i ingerowanie w jego konstrukcję.' },
  { number: 4, title: 'Odpowiedzialność', text: 'Od chwili wydania do zwrotu Najemca odpowiada za utratę, kradzież i uszkodzenia wykraczające poza normalne zużycie. Najemca pokrywa uzasadnione koszty naprawy lub odtworzenia sprzętu, z uwzględnieniem jego wartości i stopnia zużycia.' },
  { number: 5, title: 'Zwrot sprzętu', text: 'Sprzęt należy zwrócić kompletny, czysty i w terminie wskazanym w umowie. Opóźnienie może skutkować naliczeniem opłaty według aktualnej stawki dobowej za każdą rozpoczętą dobę.' },
  { number: 6, title: 'Kaucja', text: 'Kaucja zabezpiecza roszczenia Wynajmującego. Jest zwracana po terminowym zwrocie kompletnego i nieuszkodzonego sprzętu, po potrąceniu ewentualnych należności wynikających z umowy.' },
  { number: 7, title: 'Dane osobowe', text: 'Dane są przetwarzane w celu zawarcia i wykonania umowy, rozliczeń oraz dochodzenia roszczeń, zgodnie z polityką prywatności WB-Rent. Dane dokumentu tożsamości są przechowywane w postaci zaszyfrowanej.' },
  { number: 8, title: 'Podpis elektroniczny', text: 'Strony uznają podpis odręczny złożony na ekranie urządzenia za podpis elektroniczny potwierdzający zapoznanie się z pełną treścią umowy i akceptację jej warunków. System rejestruje czas, adres IP, identyfikator urządzenia oraz skróty kryptograficzne dokumentu i podpisu.' },
  { number: 9, title: 'Postanowienia końcowe', text: 'W sprawach nieuregulowanych stosuje się przepisy Kodeksu cywilnego. Zmiany umowy wymagają formy dokumentowej. Spory strony w pierwszej kolejności będą rozwiązywać polubownie.' },
];