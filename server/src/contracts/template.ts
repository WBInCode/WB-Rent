export const CONTRACT_TEMPLATE_VERSION = '5.0.0';

export interface ContractClause {
  number: string;
  title: string;
  /**
   * Numbered sub-clauses (ustępy) exactly as in the paper agreements.
   * A newline inside a point starts a new rendered line; lines opening with
   * "a) " are laid out as a lettered sub-list.
   */
  points?: string[];
  /** Single block of wording - only contracts signed before v3 use this. */
  text?: string;
}

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
    pesel: string;
  };
  rental: {
    reservationId: number;
    productId: string;
    productName: string;
    items?: Array<{
      productId: string;
      productName: string;
      categoryId: string;
      itemPrice: number;
    }>;
    startDate: string;
    endDate: string | null;
    isIndefinite: boolean;
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
  clauses: ContractClause[];
  /** Handover checklist (Załącznik nr 1) - signed together with the contract. */
  handoverItems?: string[];
}

// Non-breaking thousands separator - "3 505,50 zł" must never split across lines.
const money = (value: number) =>
  `${value.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '\u00A0')}\u00A0zł`;

export interface DeviceTerms {
  deviceName: string;
  equipmentValue: number;
  includedConsumables?: string;
  extraConsumable?: { label: string; price: number };
  mandatoryConsumable?: { label: string; price: number; note: string };
  deepCleaningNote: string;
}

export interface ClauseDevice extends DeviceTerms {
  /** Rent agreed for this single position of the reservation. */
  itemPrice: number;
  /** Rent of this position per started day - the §12 price list is per device. */
  dailyRate: number;
}

export interface ClauseInput {
  devices: ClauseDevice[];
  /** Period wording for §1 ust. 3, built from the reservation. */
  rentalPeriod: string;
  totalPrice: number;
  deposit: number;
  dailyRate: number;
  /**
   * Wszystkie skladniki naleznosci. Umowa obok dowodu zakupu jest miejscem, w
   * ktorym nie moze byc zadnej watpliwosci, za co Najemca placi - sama kwota
   * laczna tego nie tlumaczy.
   */
  costLines?: Array<{ etykieta: string; kwota: string }>;
  /** Handover facts that used to sit in a separate "Dane najmu" table. */
  accessories: string;
  conditionNotes: string;
  delivery: boolean;
  deliveryAddress?: string;
}

const LETTERS = 'abcdefghijklmnopqrstuvwxyz';
export const letter = (index: number) => LETTERS[index] ?? String(index + 1);

/** Lettered sub-list, each entry on its own line, closing with a period. */
const lettered = (entries: string[]) =>
  entries
    .map((entry, index) => `${letter(index)})\u00A0${entry}${index === entries.length - 1 ? '' : ','}`)
    .join('\n');

/** Full consumables wording for one device, used in the §12 price list. */
const consumableTerms = (device: ClauseDevice): string => {
  const terms: string[] = [];
  if (device.includedConsumables) {
    terms.push(`w cenie najmu ${device.includedConsumables}`);
  }
  if (device.extraConsumable) {
    terms.push(`dodatkowa porcja ${money(device.extraConsumable.price)} brutto za ${device.extraConsumable.label}`);
  }
  if (device.mandatoryConsumable) {
    terms.push(
      `${device.mandatoryConsumable.label} – pierwszy dzień najmu obowiązkowo rozliczana 1 szt. ` +
      `w kwocie ${money(device.mandatoryConsumable.price)} brutto, każda kolejna sztuka ` +
      `${money(device.mandatoryConsumable.price)} brutto (${device.mandatoryConsumable.note})`
    );
  }
  return terms.length > 0 ? terms.join('; ') : 'brak materiałów eksploatacyjnych rozliczanych odrębnie';
};

/**
 * Wording reproduced from the signed paper agreements in "Dokumenty wynajem",
 * including the original §2a/§3a numbering and every ustęp. Only the values
 * left blank on paper (device, period, amounts) are injected.
 */
export function buildContractClauses(input: ClauseInput): ContractClause[] {
  const {
    devices,
    rentalPeriod,
    totalPrice,
    deposit,
    dailyRate,
    costLines,
    accessories,
    conditionNotes,
    delivery,
    deliveryAddress,
  } = input;
  const multi = devices.length > 1;
  const names = devices.map((device) => device.deviceName);
  const totalValue = devices.reduce((sum, device) => sum + device.equipmentValue, 0);

  const subjectPoint = multi
    ? `Wynajmujący oddaje Najemcy w najem następujący Sprzęt:\n${lettered(names)}.\nSprzęt zostaje wydany wraz z kompletem akcesoriów wyszczególnionych w Protokole wydania (Załącznik nr 1).`
    : `Wynajmujący oddaje Najemcy w najem urządzenie ${names[0]} wraz z kompletem akcesoriów wyszczególnionych w Protokole wydania (Załącznik nr 1), dalej „Sprzęt”.`;

  const manuals = multi
    ? `Instrukcje obsługi urządzeń: ${names.join(', ')}`
    : `Instrukcja obsługi ${names[0]}`;
  const valuePoint = multi
    ? `Wartość przedmiotu najmu Strony uzgadniają na kwoty:\n${lettered(
        devices.map((device) => `${device.deviceName} – ${money(device.equipmentValue)}`)
      )}.\nŁączna wartość Sprzętu wynosi ${money(totalValue)}.`
    : `Wartość przedmiotu najmu Strony uzgadniają na kwotę ${money(totalValue)}.`;

  const handoverPoint = delivery
    ? `Wydanie i zwrot Sprzętu następuje pod adresem wskazanym przez Najemcę: ${deliveryAddress || 'adres wskazany w zamówieniu'}. Opłaty za dostawę i odbiór określa §12 (Cennik).`
    : 'Wydanie i zwrot następuje w punkcie Wynajmującego: Rzeszów, ul. J. Słowackiego 24/11 (odbiór osobisty), chyba że Strony uzgodnią inaczej – w formie pisemnej (w tym e-mail/SMS) lub podczas rezerwacji Sprzętu na stronie wb-rent.pl.';

  const rentPoint = multi
    ? `Czynsz najmu za cały uzgodniony okres wynosi ${money(totalPrice)} brutto i obejmuje:\n${lettered(
        devices.map((device) => `${device.deviceName} – ${money(device.itemPrice)}`)
      )}.\nPłatność za uzgodniony okres najmu oraz za każdy kolejny okres przedłużenia następuje z góry, najpóźniej przed upływem bieżącego okresu najmu.`
    : `Czynsz najmu za cały uzgodniony okres wynosi ${money(totalPrice)} brutto. Płatność za uzgodniony okres najmu oraz za każdy kolejny okres przedłużenia następuje z góry, najpóźniej przed upływem bieżącego okresu najmu.`;

  // Pelne wyliczenie naleznosci. Bez niego z umowy nie dalo sie odczytac, skad
  // bierze sie kwota laczna - a to jedyne miejsce obok dowodu zakupu, ktore
  // musi tlumaczyc kazda zlotowke.
  const breakdownPoint = costLines && costLines.length > 0
    ? `Na kwotę należną składają się:\n${lettered(
        costLines.map((line) => `${line.etykieta} – ${line.kwota.replace(/ /g, '\u00A0')}`)
      )}.\nŁącznie do zapłaty: ${money(totalPrice)} brutto.${
        deposit > 0
          ? ` Kwota ta nie obejmuje kaucji zwrotnej ${money(deposit)}, o której mowa w §7.`
          : ''
      } Powyższe wyliczenie wyczerpuje należności za uzgodniony okres najmu; opłaty dodatkowe mogą wynikać wyłącznie z §12 (Cennik) i wymagają zaistnienia opisanych tam zdarzeń.`
    : null;

  const included = devices.filter((device) => device.includedConsumables);
  const consumablesInRent = included.length > 0
    ? ` W cenę wliczone jest ${
        multi
          ? included.map((device) => `${device.includedConsumables} (${device.deviceName})`).join(', ')
          : included[0].includedConsumables
      }; ceny dodatkowych porcji, opłat porządkowych i usług określa §12 (Cennik).`
    : ' Ceny materiałów eksploatacyjnych, opłat porządkowych i usług określa §12 (Cennik).';

  // §12 is broken down device by device - the price list is the legal basis for
  // every extra charge, so nothing may hide behind a shared "and so on".
  const dailyRatePoint = multi
    ? `Stawki najmu za każdą rozpoczętą dobę:\n${lettered(
        devices.map((device) => `${device.deviceName} – ${money(device.dailyRate)} brutto za dobę`)
      )}.\nŁączna stawka dobowa za cały Sprzęt wynosi ${money(dailyRate)} brutto.`
    : `Stawka najmu za każdą rozpoczętą dobę: ${money(dailyRate)} brutto.`;

  const consumablesPoint = multi
    ? `Materiały eksploatacyjne – odrębnie dla każdego urządzenia:\n${lettered(
        devices.map((device) => `${device.deviceName} – ${consumableTerms(device)}`)
      )}.`
    : `Materiały eksploatacyjne: ${consumableTerms(devices[0])}.`;

  const cleaningPoint = multi
    ? `Za ponadprzeciętne zabrudzenia, uzasadniające czyszczenie pogłębione, uznaje się w szczególności:\n${lettered(
        devices.map((device) => `${device.deviceName} – ${device.deepCleaningNote}`)
      )}.`
    : `Za ponadprzeciętne zabrudzenia, uzasadniające czyszczenie pogłębione, uznaje się w szczególności: ${devices[0].deepCleaningNote}.`;

  const attachments = [
    'Załącznik nr 1: Protokół wydania Sprzętu',
    'Załącznik nr 2: Protokół zwrotu Sprzętu',
    `Załącznik nr 3: ${manuals}`,
  ].join('; ');

  return [
    {
      number: '1',
      title: 'Przedmiot i okres najmu',
      points: [
        subjectPoint,
        valuePoint,
        `Okres najmu: ${rentalPeriod}.`,
        handoverPoint,
        `Akcesoria wydawane wraz ze Sprzętem: ${accessories}.`,
        `Stan Sprzętu przy wydaniu: ${conditionNotes}. Najemca przy wydaniu potwierdza odbiór Sprzętu oraz zapoznanie się z Załącznikiem nr 3 – ${manuals} i odbycie krótkiego szkolenia z obsługi, poprzez podpisanie Protokołu wydania (Załącznik nr 1).`,
        'Reprezentacja Najemcy (przedsiębiorcy): Jeżeli Najemcą jest przedsiębiorca, działa on przez uprawnionego przedstawiciela. Oświadczenia osoby podpisującej umowę uważa się za złożone w imieniu i na rzecz Najemcy.',
      ],
    },
    {
      number: '2',
      title: 'Rozliczenie najmu',
      points: [
        `${rentPoint}${consumablesInRent}`,
        ...(breakdownPoint ? [breakdownPoint] : []),
        'Rozliczenie usługi najmu następuje w chwili zwrotu Sprzętu, po sporządzeniu Protokołu zwrotu (Załącznik nr 2). W tym momencie Wynajmujący wystawi i wyda Najemcy dowód zakupu dokumentujący najem wraz z ewentualnymi świadczeniami dodatkowymi (w tym opłatami wskazanymi w §12 Cennik).',
        'Strony zgodnie postanawiają, że stan Sprzętu przy zwrocie oraz wynikające z niego należności – opłaty porządkowe, koszty braków lub rozkompletowania zestawu i koszty uszkodzeń – zostaną stwierdzone i wyliczone w Protokole zwrotu (Załącznik nr 2), według stawek określonych w §12 (Cennik) oraz zasad z ust. 4 niniejszego paragrafu. Protokół zwrotu podpisany przez obie Strony stanowi wystarczającą podstawę do naliczenia tych należności i nie wymaga zawarcia aneksu do niniejszej Umowy. Najemca zobowiązuje się do ich zapłaty w terminie 7 dni od doręczenia dokumentu sprzedaży.',
        'Jeżeli w toku oględzin przy zwrocie stwierdzone zostaną uszkodzenia Sprzętu lub usterki wymagające naprawy, Wynajmujący zleci naprawę w autoryzowanym serwisie Kärcher (ERPIX Kärcher Rzeszów) lub innym autoryzowanym serwisie Kärcher. Najemca zostanie obciążony rzeczywistymi, udokumentowanymi kosztami naprawy/części wykazanymi na fakturze serwisowej, którą jest zobowiązany opłacić w terminie 7 dni. Do czasu otrzymania faktury serwisu w Protokole zwrotu odnotowuje się samą pozycję kosztu, a jego wysokość Wynajmujący wskazuje po wycenie.',
        'Za opóźnienie w zapłacie wszelkich należności z Umowy Wynajmującemu przysługują odsetki ustawowe za opóźnienie.',
      ],
    },
    {
      number: '2a',
      title: 'Kaucja',
      points: [
        deposit > 0
          ? `Strony postanowiły o pobraniu kaucji. Najemca wpłaca kaucję w wysokości ${money(deposit)} brutto.`
          : 'Strony nie postanowiły o pobieraniu kaucji – kaucja wynosi 0,00 zł. Jeżeli Strony uzgodnią pobranie kaucji, Najemca wpłaca ją w uzgodnionej wysokości, a dalsze ustępy niniejszego paragrafu stosuje się odpowiednio.',
        'Niniejszy paragraf stosuje się wyłącznie, gdy kaucja została pobrana zgodnie z ust. 1.',
        'Kaucja zabezpiecza roszczenia Wynajmującego z tytułu: a) niewniesionego wynagrodzenia za najem, b) opłat dodatkowych z §12 (Cennik), c) kosztów napraw Sprzętu wynikających z faktury serwisu autoryzowanego, d) braków lub rozkompletowania elementów zestawu (wg cen producenta/serwisu).',
        'Po zwrocie Sprzętu i zakończeniu weryfikacji jego stanu (a w razie napraw – po otrzymaniu faktury serwisu) Wynajmujący dokona rozliczenia kaucji w terminie 7 dni – zwracając niewykorzystaną część albo zaliczając kaucję na poczet należności.',
        'Najemca wyraża zgodę na potrącenie z kaucji należności wskazanych w ust. 3; ewentualną różnicę Najemca dopłaca w terminie 7 dni od doręczenia dokumentu sprzedaży.',
      ],
    },
    {
      number: '3',
      title: 'Użytkowanie i odpowiedzialność Najemcy',
      points: [
        `Najemca oświadcza, że odebrał Sprzęt sprawny, został przeszkolony i otrzymał Załącznik nr 3 – ${manuals}, co potwierdza w Protokole wydania (Załącznik nr 1).`,
        'Najemca zobowiązuje się użytkować Sprzęt zgodnie z przeznaczeniem i Instrukcją obsługi (Załącznik nr 3), dbać o prawidłową eksploatację oraz nie oddawać Sprzętu w podnajem ani do używania osobom trzecim bez zgody Wynajmującego.',
        'Najemca ponosi odpowiedzialność odszkodowawczą za utratę lub uszkodzenie Sprzętu w okresie najmu na zasadach ogólnych (art. 471 k.c.), z wyłączeniem szkód zawinionych przez Wynajmującego lub wynikłych z ukrytej wady Sprzętu. O każdej awarii Najemca niezwłocznie informuje Wynajmującego i wstrzymuje eksploatację do czasu uzgodnień.',
        'Wszelkie naprawy (także gwarancyjne) wykonywane są wyłącznie po uzgodnieniu z Wynajmującym i w autoryzowanym serwisie. Koszty napraw wynikłe z naruszenia Instrukcji obciążają Najemcę i są rozliczane na podstawie faktury serwisowej, płatnej w terminie 7 dni od doręczenia dokumentu.',
      ],
    },
    {
      number: '3a',
      title: 'Odpowiedzialność Wynajmującego',
      points: [
        'Wynajmujący nie ponosi odpowiedzialności za szkody Najemcy lub osób trzecich: a) wynikłe w związku z korzystaniem ze Sprzętu przez Najemcę, b) powstałe wskutek korzystania niezgodnie z Instrukcją, niewłaściwego transportu, składowania, przechowywania lub konserwacji, c) będące następstwem posługiwania się Sprzętem niezgodnie z ogólnie przyjętymi zasadami obsługi.',
        'Powyższe wyłączenia stosuje się w zakresie dopuszczalnym przez prawo i nie dotyczą szkód spowodowanych winą umyślną lub rażącym niedbalstwem Wynajmującego ani odpowiedzialności, której wyłączyć nie można na mocy bezwzględnie obowiązujących przepisów.',
      ],
    },
    {
      number: '4',
      title: 'Brak zwrotu, rozkompletowanie zestawu',
      points: [
        'W przypadku nieoddania Sprzętu w terminie określonym w §1 ust. 3 oraz braku skutecznego przedłużenia najmu zgodnie z §5 ust. 3, Najemca zobowiązuje się do zapłaty kary umownej w wysokości 200,00 zł (dwieście złotych 00/100) za każdy rozpoczęty dzień opóźnienia, niezależnie od obowiązku zwrotu Sprzętu oraz zapłaty należnego czynszu najmu i innych należności z Umowy.',
        `W razie dalszego braku zwrotu Sprzętu i po bezskutecznym wezwaniu Najemca zobowiązuje się dodatkowo do zapłaty równowartości rynkowej Sprzętu według wartości wskazanej w §1, tj. ${money(totalValue)}, oraz do pokrycia szkód wynikających z utraty, w tym utraconych korzyści Wynajmującego odpowiadających wynagrodzeniu za najem wg stawki dobowej z §12 (Cennik), za każdy dzień, w którym Sprzęt nie mógł być wynajmowany osobom trzecim.`,
        'Zapłata kary umownej nie wyłącza prawa Wynajmującego do dochodzenia odszkodowania przewyższającego jej wysokość na zasadach ogólnych.',
        'Najemca ponosi wszelkie uzasadnione koszty: a) odbioru i transportu Sprzętu, b) windykacji, c) postępowań związanych z odzyskaniem Sprzętu.',
        'W przypadku częściowej utraty lub uszkodzenia elementów zestawu (wąż, rura, kolanko, dysze) Najemca pokrywa koszty odtworzenia wg cen producenta/dystrybutora lub wg faktury serwisu.',
      ],
    },
    {
      number: '5',
      title: 'Wydanie, dostawa i odbiór; przedłużenie i opóźnienie',
      points: [
        'Wydanie i zwrot Sprzętu odbywa się co do zasady w miejscu wskazanym w §1 ust. 4, w dniach i godzinach uzgodnionych przez Strony.',
        'Dostawa i odbiór na terenie Rzeszowa mogą zostać wykonane na życzenie Najemcy; opłaty i warunki tych usług określa §12 (Cennik).',
        'Przedłużenie najmu wymaga uprzedniej zgody Wynajmującego oraz opłacenia z góry kolejnego okresu najmu przed upływem bieżącego okresu najmu; stawki za przedłużenie/rozpoczętą dobę określa §12 (Cennik). Brak zapłaty w tym terminie oznacza brak skutecznego przedłużenia.',
        'W przypadku rażącego naruszenia warunków umowy przez Najemcę (w tym bezumownego przetrzymania Sprzętu, braku kontaktu, uzasadnionego podejrzenia wyłudzenia) Wynajmujący może, po wezwaniu do niezwłocznego zwrotu, odstąpić od umowy ze skutkiem natychmiastowym i podjąć czynności zmierzające do odzyskania Sprzętu.',
      ],
    },
    {
      number: '6',
      title: 'Kontakt i komunikacja operacyjna',
      points: [
        'Kontakt techniczny i operacyjny (zgłoszenia awarii, zmiany godzin, opóźnienia, ustalenie miejsca odbioru/dostawy): tel. +48 570 038 828; e-mail: kamil.kida@wb-partners.pl.',
        'Zmiana godzin wydania/zwrotu lub zmiana miejsca odbioru/dostawy wymaga kontaktu zgodnie z ust. 1 i jest skuteczna po potwierdzeniu przez Wynajmującego (e-mail/SMS/telefonicznie).',
        'W przypadku spodziewanego opóźnienia w wydaniu/zwrocie Najemca zobowiązany jest niezwłocznie poinformować Wynajmującego kanałami wskazanymi w ust. 1. Skutki finansowe opóźnień i przedłużeń określa §12 (Cennik).',
      ],
    },
    {
      number: '7',
      title: 'Kontrola i miejsce użytkowania',
      points: [
        'Najemca informuje Wynajmującego o miejscu użytkowania lub przechowywania Sprzętu; Wynajmujący ma prawo dostępu do tego miejsca w uzgodnionym terminie, w zakresie niezbędnym do kontroli stanu i kompletności Sprzętu.',
      ],
    },
    {
      number: '8',
      title: 'Ochrona danych osobowych (RODO)',
      points: [
        'Zgodnie z art. 13 Rozporządzenia Parlamentu Europejskiego i Rady (UE) 2016/679 z dnia 27 kwietnia 2016 r. (RODO) Wynajmujący informuje, że administratorem danych osobowych Najemcy jest WB Partners Sp. z o.o. z siedzibą przy ul. J. Słowackiego 24/11, 35-060 Rzeszów, e-mail: office@wb-partners.pl, tel. 570 038 552. Spółka nie powołała Inspektora Ochrony Danych – kontakt z administratorem następuje pod wskazanymi wyżej danymi.',
        'Cele i podstawy prawne przetwarzania danych:\n' + lettered([
          'zawarcie i realizacja umowy najmu (rezerwacja, wydanie, rozliczenia, protokoły, zwrot) – art. 6 ust. 1 lit. b RODO',
          'wypełnienie obowiązków prawnych (rachunkowość, podatki) – art. 6 ust. 1 lit. c RODO',
          'dochodzenie lub obrona przed roszczeniami oraz organizacja obsługi serwisowej i napraw w autoryzowanym serwisie – prawnie uzasadniony interes administratora – art. 6 ust. 1 lit. f RODO',
          'komunikacja operacyjna związana z umową (zmiany godzin, dostawa i odbiór Sprzętu, przypomnienia o terminie) – art. 6 ust. 1 lit. b lub f RODO',
        ]) + '.',
        'Kategorie odbiorców danych:\n' + lettered([
          'podmioty świadczące usługi księgowe, IT/hosting i wsparcie techniczne',
          'operatorzy dostaw i kurierzy – w zakresie niezbędnym do dostawy lub odbioru Sprzętu',
          'autoryzowany serwis Kärcher – wyłącznie przy obsłudze napraw i ekspertyz',
          'kancelarie prawne i podmioty windykacyjne – przy dochodzeniu roszczeń',
          'organy publiczne – gdy wynika to z przepisów prawa',
        ]) + '.\nDane nie są przekazywane poza Europejski Obszar Gospodarczy ani organizacjom międzynarodowym.',
        'Okres przechowywania danych:\n' + lettered([
          'przez okres obowiązywania umowy oraz do czasu przedawnienia roszczeń (co do zasady 6 lat, a dla roszczeń okresowych – 3 lata)',
          'przez okres wynikający z przepisów rachunkowych i podatkowych – co do zasady do 6 lat liczonych od końca roku kalendarzowego, w którym powstał obowiązek podatkowy',
          'następnie w niezbędnym zakresie – wyłącznie na potrzeby ustalenia, dochodzenia lub obrony roszczeń',
        ]) + '.',
        'Osobie, której dane dotyczą, przysługuje prawo dostępu do danych, ich sprostowania, usunięcia lub ograniczenia przetwarzania, przenoszenia danych, wniesienia sprzeciwu wobec przetwarzania opartego na art. 6 ust. 1 lit. f RODO, a także prawo wniesienia skargi do Prezesa Urzędu Ochrony Danych Osobowych (ul. Stawki 2, 00-193 Warszawa).',
        'Podanie danych jest dobrowolne, jednak niezbędne do zawarcia i wykonania umowy najmu; brak podania danych uniemożliwi zawarcie umowy i wydanie Sprzętu.',
        'Dane nie są wykorzystywane do zautomatyzowanego podejmowania decyzji, w tym profilowania.',
        'Numer PESEL oraz dane dokumentu tożsamości Najemcy przechowywane są w postaci zaszyfrowanej.',
        'Najemca oświadcza, że zapoznał się z treścią niniejszej klauzuli informacyjnej RODO, co potwierdza podpisem złożonym pod niniejszą Umową.',
      ],
    },
    {
      number: '9',
      title: 'Zmiany umowy – forma',
      points: [
        'Wszelkie zmiany i uzupełnienia niniejszej umowy wymagają formy pisemnej (w tym e-mail/SMS zaakceptowany przez obie Strony) pod rygorem nieważności.',
      ],
    },
    {
      number: '10',
      title: 'Rozwiązywanie sporów',
      points: [
        'Strony zobowiązują się dążyć do polubownego rozwiązania wszelkich sporów wynikających z niniejszej umowy. W razie braku porozumienia spór zostanie rozstrzygnięty przez sąd powszechny właściwy rzeczowo, zgodnie z przepisami Kodeksu postępowania cywilnego.',
      ],
    },
    {
      number: '11',
      title: 'Postanowienia końcowe',
      points: [
        'Umowę zawarto w postaci elektronicznej; każda ze Stron otrzymuje jednobrzmiący egzemplarz w postaci pliku PDF utrwalonego po złożeniu podpisów.',
        `Integralną część umowy stanowią: ${attachments}.`,
      ],
    },
    {
      number: '12',
      title: 'Cennik',
      points: [
        dailyRatePoint,
        'Przedłużenie/rozpoczęta doba: stawki jak w ust. 1 (chyba że Strony uzgodnią inne w potwierdzeniu rezerwacji); warunkiem skutecznego przedłużenia jest zgoda Wynajmującego i opłata z góry przed upływem bieżącego okresu najmu.',
        'Kara umowna za bezumowne przetrzymanie Sprzętu: 200,00 zł za każdy rozpoczęty dzień opóźnienia; stawka ta ma na celu zabezpieczenie terminowego zwrotu Sprzętu, pokrycie zwiększonych kosztów operacyjnych Wynajmującego oraz rekompensatę utraconej możliwości dalszego wynajmu.',
        consumablesPoint,
        'Opłaty porządkowe przy zwrocie: a) 30,00 zł brutto dodatkowo – czyszczenie standardowe, b) do 50,00 zł brutto dodatkowo – czyszczenie pogłębione.',
        cleaningPoint,
        'Dostawa / odbiór: a) 20,00 zł brutto (każdorazowo) – dostawa lub odbiór na terenie Rzeszowa, b) 30,00 zł brutto (każdorazowo) – obsługa w soboty/niedziele/święta (otwarcie biura dla odbioru/zwrotu na miejscu); opłata nie obejmuje dostawy/odbioru – w razie dostawy/odbioru w te dni dolicza się dodatkowo opłatę z lit. a).',
        'Braki/rozkompletowanie/części zamienne: wg cen producenta/dystrybutora lub wg faktury serwisu.',
        'Naprawy serwisowe po stronie Najemcy: wg faktury serwisu autoryzowanego (ERPIX Kärcher Rzeszów) lub innego autoryzowanego serwisu Kärcher.',
        'UWAGA! SPRZĘT NIE JEST UBEZPIECZONY OD KRADZIEŻY I USZKODZEŃ U NAJEMCY.',
      ],
    },
    {
      number: '13',
      title: 'Podpis elektroniczny',
      points: [
        'Strony uznają podpis odręczny złożony na ekranie urządzenia za podpis elektroniczny potwierdzający zapoznanie się z pełną treścią umowy wraz z załącznikami i akceptację jej warunków.',
        'System rejestruje czas złożenia podpisu, adres IP, identyfikator urządzenia oraz skróty kryptograficzne dokumentu i podpisu.',
        'Umowa zostaje utrwalona w postaci pliku PDF przekazywanego Najemcy na wskazany adres e-mail wraz z instrukcjami obsługi wynajętych urządzeń.',
      ],
    },
  ];
}
