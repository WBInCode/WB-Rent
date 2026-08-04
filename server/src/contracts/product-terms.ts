// Legal per-product data taken from the signed paper contracts in
// "Dokumenty wynajem". Prices that the admin panel can change (daily rate)
// are deliberately NOT duplicated here - the contract renders the amount that
// was actually agreed for the reservation.

export interface ProductTerms {
  /** Wording used in the contract heading, e.g. "odkurzacza piorącego Kärcher Puzzi 10/1". */
  contractSubject: string;
  /** Device name as it appears in clauses and the handover protocol. */
  deviceName: string;
  /** Agreed replacement value of the equipment (§1 and §4). */
  equipmentValue: number;
  /** Consumables included in the rent, or null when the device uses none. */
  includedConsumables?: string;
  /** Price of an extra portion of the consumable. */
  extraConsumable?: { label: string; price: number };
  /** Mandatory consumable settled on day one (filter bags). */
  mandatoryConsumable?: { label: string; price: number; note: string };
  /** Checklist signed at handover (Załącznik nr 1). */
  handoverItems: string[];
  /** Wording of the deeper-cleaning fee, which differs for dry vacuums. */
  deepCleaningNote: string;
  /** File name of the operating manual attached to the customer e-mail. */
  manualFile?: string;
}

const CHEMICAL_CLEANING_NOTE =
  'nieprzepłukany układ chemii, ślady piany/chemii w przewodach lub końcówkach, zabrudzone zbiorniki';
const DRY_CLEANING_NOTE =
  'mocno zabrudzone lub zalepione pyłem wnętrze zbiornika, ślady błota/osadów w przewodach lub końcówkach, zabrudzony filtr, zabrudzenia wymagające dodatkowego mycia';

export const productTerms: Record<string, ProductTerms> = {
  'puzzi-10-1': {
    contractSubject: 'odkurzacza piorącego Kärcher Puzzi 10/1',
    deviceName: 'Kärcher Puzzi 10/1',
    equipmentValue: 4551,
    includedConsumables: '2 × 100 g środka czyszczącego Kärcher RM 760',
    extraConsumable: { label: 'RM 760 (100 g)', price: 10 },
    handoverItems: [
      'Odkurzacz Kärcher Puzzi 10/1',
      'Wąż spryskująco-odsysający 2,5 m',
      'Dysza podłogowa z kolankiem i rurą ssącą',
      'Dysza ręczna do tapicerki',
      'Ssawka szczelinowa',
      'Środek czyszczący Kärcher RM 760',
    ],
    deepCleaningNote: CHEMICAL_CLEANING_NOTE,
    manualFile: 'instrukcja-puzzi-10-1.pdf',
  },

  'puzzi-8-1': {
    contractSubject: 'odkurzacza piorącego Kärcher Puzzi 8/1 Anniversary',
    deviceName: 'Kärcher Puzzi 8/1 Anniversary',
    equipmentValue: 3505.5,
    includedConsumables: '2 × 100 g środka czyszczącego Kärcher RM 760',
    extraConsumable: { label: 'RM 760 (100 g)', price: 10 },
    handoverItems: [
      'Odkurzacz Kärcher Puzzi 8/1 Anniversary',
      'Wąż spryskująco-odsysający 2,5 m',
      'Dysza ręczna do tapicerki',
      'Środek czyszczący Kärcher RM 760',
    ],
    deepCleaningNote: CHEMICAL_CLEANING_NOTE,
    manualFile: 'instrukcja-puzzi-8-1.pdf',
  },

  'nt-22-1': {
    contractSubject: 'odkurzacza Kärcher NT 22/1 Ap L',
    deviceName: 'Kärcher NT 22/1 Ap L',
    equipmentValue: 984,
    mandatoryConsumable: {
      label: 'worek filtrujący',
      price: 15,
      note: 'Worki filtrujące są wydawane w oryginalnych opakowaniach jednostkowych. Zwrot jest możliwy wyłącznie w stanie nienaruszonym; w razie otwarcia lub rozerwania opakowania zwrot nie przysługuje, ponieważ worki stanowią materiał zużywalny.',
    },
    handoverItems: [
      'Odkurzacz Kärcher NT 22/1 Ap L',
      'Wąż ssący',
      'Rury ssące',
      'Dysza podłogowa',
      'Ssawka szczelinowa',
      'Worek filtrujący',
    ],
    deepCleaningNote: DRY_CLEANING_NOTE,
    manualFile: 'instrukcja-nt-22-1.pdf',
  },

  'nt-30-1': {
    contractSubject: 'odkurzacza Kärcher NT 30/1 Tact Te L Anniversary',
    deviceName: 'Kärcher NT 30/1 Tact Te L Anniversary',
    equipmentValue: 3505.5,
    mandatoryConsumable: {
      label: 'worek filtrujący',
      price: 15,
      note: 'Worki filtrujące są wydawane w oryginalnych opakowaniach jednostkowych. Zwrot jest możliwy wyłącznie w stanie nienaruszonym; w razie otwarcia lub rozerwania opakowania zwrot nie przysługuje, ponieważ worki stanowią materiał zużywalny.',
    },
    handoverItems: [
      'Odkurzacz Kärcher NT 30/1 Tact Te L Anniversary',
      'Wąż ssący',
      'Rury ssące',
      'Dysza podłogowa',
      'Ssawka szczelinowa',
      'Worek filtrujący',
    ],
    deepCleaningNote: DRY_CLEANING_NOTE,
    manualFile: 'instrukcja-nt-30-1.pdf',
  },

  'ad-4-premium': {
    contractSubject: 'odkurzacza kominkowego Kärcher AD 4 Premium',
    deviceName: 'Kärcher AD 4 Premium',
    equipmentValue: 789,
    handoverItems: [
      'Odkurzacz kominkowy Kärcher AD 4 Premium',
      'Wąż ssący metalowy',
      'Rura ssąca',
      'Filtr metalowy',
    ],
    deepCleaningNote: DRY_CLEANING_NOTE,
    manualFile: 'instrukcja-ad-4-premium.pdf',
  },

  'wvp-10-adv': {
    contractSubject: 'myjki do okien Kärcher WVP 10 Adv',
    deviceName: 'Kärcher WVP 10 Adv',
    equipmentValue: 1142,
    includedConsumables: '2 × 20 ml środka do szyb Kärcher RM 503',
    extraConsumable: { label: 'RM 503 (20 ml)', price: 3 },
    handoverItems: [
      'Myjka do okien Kärcher WVP 10 Adv',
      'Ssawka szeroka',
      'Nakładka z mikrofibry',
      'Butelka ze spryskiwaczem',
      'Środek do szyb Kärcher RM 503',
      'Ładowarka',
    ],
    deepCleaningNote: CHEMICAL_CLEANING_NOTE,
    manualFile: 'instrukcja-wvp-10-adv.pdf',
  },

  'sg-4-4': {
    contractSubject: 'parownicy Kärcher SG 4/4',
    deviceName: 'Kärcher SG 4/4',
    equipmentValue: 6550,
    handoverItems: [
      'Parownica Kärcher SG 4/4',
      'Wąż parowy',
      'Rury przedłużające',
      'Dysza podłogowa',
      'Dysza ręczna',
      'Dysza punktowa',
    ],
    deepCleaningNote: CHEMICAL_CLEANING_NOTE,
    manualFile: 'instrukcja-sg-4-4.pdf',
  },

  'dmuchawa-ab-20': {
    contractSubject: 'dmuchawy Kärcher AB 20 EC',
    deviceName: 'Kärcher AB 20 EC',
    equipmentValue: 3075,
    handoverItems: ['Dmuchawa Kärcher AB 20 EC', 'Przewód zasilający'],
    deepCleaningNote: DRY_CLEANING_NOTE,
  },

  'ozonmed-pro-10g': {
    contractSubject: 'ozonatora powietrza Ozonmed PRO 10G',
    deviceName: 'Ozonmed PRO 10G',
    equipmentValue: 799,
    handoverItems: ['Ozonator powietrza Ozonmed PRO 10G', 'Przewód zasilający'],
    deepCleaningNote: DRY_CLEANING_NOTE,
    manualFile: 'instrukcja-ozonmed-pro-10g.pdf',
  },

  'es-1-7-bp': {
    contractSubject: 'systemu do dezynfekcji Kärcher ES 1/7 Bp Pack',
    deviceName: 'Kärcher ES 1/7 Bp Pack',
    equipmentValue: 4034.4,
    includedConsumables: '2 × 20 ml środka dezynfekującego Kärcher RM 735',
    extraConsumable: { label: 'RM 735 (20 ml)', price: 3 },
    handoverItems: [
      'System do dezynfekcji Kärcher ES 1/7 Bp Pack',
      'Zbiornik plecakowy',
      'Lanca z dyszą',
      'Akumulator',
      'Ładowarka',
      'Środek dezynfekujący Kärcher RM 735',
    ],
    deepCleaningNote: CHEMICAL_CLEANING_NOTE,
  },
};

export const getProductTerms = (productId: string): ProductTerms | undefined =>
  productTerms[productId];
