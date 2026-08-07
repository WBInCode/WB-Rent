import { pl } from '@/utils/typography';
import type { ContractPreviewResponse } from '@/services/api';

type Snapshot = ContractPreviewResponse['snapshot'];

const polishDate = (value: string) => {
  const [year, month, day] = value.slice(0, 10).split('-');
  return day && month && year ? `${day}.${month}.${year}` : value;
};

const lessorLines = (snapshot: Snapshot): string[] => [
  `${snapshot.lessor.name} z siedzibą w Rzeszowie,`,
  `${snapshot.lessor.address},`,
  `NIP ${snapshot.lessor.nip},`,
  `reprezentowaną przez: ${snapshot.lessor.representative},`,
  'zwaną dalej „Wynajmującym",',
];

const renterLines = (snapshot: Snapshot): string[] => {
  const documentLabel = snapshot.renter.documentType === 'dowod_osobisty' ? 'dowodem osobistym' : 'paszportem';
  return [
    `${snapshot.renter.name},`,
    `zamieszkałym/ą: ${snapshot.renter.address},`,
    snapshot.renter.pesel ? `PESEL ${snapshot.renter.pesel},` : '',
    snapshot.renter.documentNumber
      ? `legitymującym/ą się ${documentLabel} nr ${snapshot.renter.documentNumber},`
      : '',
    `e-mail: ${snapshot.renter.email},`,
    `tel. ${snapshot.renter.phone},`,
    'zwanym/ą dalej „Najemcą",',
  ].filter(Boolean);
};

function PartyBlock({ lines }: { lines: string[] }) {
  return (
    <div>
      {lines.map((line, index) => (
        <p key={index}>{pl(line)}</p>
      ))}
    </div>
  );
}

/** One ustęp; embedded newlines become separate lines, "a) …" becomes a sub-list. */
function ClausePoint({ index, point }: { index: number; point: string }) {
  return (
    <li>
      {point.split('\n').map((line, lineIndex) => {
        const sub = /^([a-z]\))[\u00A0\s]*(.*)$/s.exec(line);
        if (sub) {
          return (
            <div key={lineIndex} className="flex gap-2 pl-7">
              <span className="shrink-0">{sub[1]}</span>
              <span>{pl(sub[2])}</span>
            </div>
          );
        }
        if (lineIndex === 0) {
          return (
            <div key={lineIndex} className="flex gap-2">
              <span className="shrink-0 w-5 tabular-nums">{index + 1}.</span>
              <span className="sm:text-justify">{pl(line)}</span>
            </div>
          );
        }
        return <div key={lineIndex} className="pl-7 sm:text-justify">{pl(line)}</div>;
      })}
    </li>
  );
}

/**
 * Treść umowy najmu. Ten sam dokument czyta klient z linku i obie Strony przy
 * ladzie — gdyby istniał w dwóch kopiach, zmiana w jednej po cichu rozjechałaby
 * się z drugą, a to jest dokument, pod którym ludzie się podpisują.
 */
export function ContractDocument({ snapshot }: { snapshot: Snapshot }) {
  return (
    <>
      <div className="text-center border-b border-[#b8972a] pb-6 mb-7">
        <img src="/wb-rent-logo.svg" alt="WB-Rent" className="h-16 sm:h-20 mx-auto" />
        <h1 className="text-2xl sm:text-3xl font-bold mt-3">UMOWA NAJMU SPRZĘTU</h1>
        <p className="text-sm text-neutral-500 mt-2">nr&nbsp;{snapshot.contractNumber}</p>
      </div>

      <div className="space-y-4 text-sm leading-6 text-neutral-800">
        <p>{pl(`Umowa najmu zawarta w dniu ${polishDate(snapshot.generatedAt)} r. w Rzeszowie pomiędzy:`)}</p>
        <PartyBlock lines={lessorLines(snapshot)} />
        <p>a</p>
        <PartyBlock lines={renterLines(snapshot)} />
        <p>{pl('zwanymi dalej łącznie „Stronami", o następującej treści:')}</p>
      </div>

      <div className="mt-7 space-y-6">
        {snapshot.clauses.map((clause) => (
          <article key={clause.number}>
            <h3 className="text-center font-bold text-[15px] leading-5">§{clause.number}</h3>
            <h4 className="text-center font-bold text-sm mb-2">{pl(clause.title)}</h4>
            {clause.points?.length ? (
              <ol className="space-y-1.5 text-sm leading-6 text-neutral-700">
                {clause.points.map((point, index) => (
                  <ClausePoint key={index} index={index} point={point} />
                ))}
              </ol>
            ) : (
              <p className="text-sm leading-6 text-neutral-700 sm:text-justify">{pl(clause.text || '')}</p>
            )}
          </article>
        ))}
      </div>
    </>
  );
}

export default ContractDocument;
