import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Trasa zadeklarowana wewnatrz innej trasy rejestruje sie dopiero przy pierwszym
 * wywolaniu tej zewnetrznej (wczesniej zwraca 404) i dokłada kolejna kopie przy
 * kazdym nastepnym - stos routera rosnie bez konca. Taki blad realnie wystapil
 * w admin.ts: /reservations/:id/mark-paid dzialalo dopiero po pobraniu listy
 * rezerwacji. Test pilnuje, zeby nie wrocil.
 */

const KATALOG = join(__dirname, '..', 'src');

function plikiZrodlowe(katalog: string): string[] {
  return readdirSync(katalog, { withFileTypes: true }).flatMap((wpis) => {
    const sciezka = join(katalog, wpis.name);
    if (wpis.isDirectory()) return plikiZrodlowe(sciezka);
    return wpis.isFile() && sciezka.endsWith('.ts') ? [sciezka] : [];
  });
}

const DEKLARACJA_TRASY = /^(\s*)router\.(get|post|put|patch|delete|use|all)\s*\(/;

describe('rejestracja tras', () => {
  const pliki = plikiZrodlowe(KATALOG);

  it('znajduje pliki zrodlowe do sprawdzenia', () => {
    expect(pliki.length).toBeGreaterThan(0);
  });

  it.each(pliki.map((p) => [p.slice(KATALOG.length + 1), p]))(
    '%s deklaruje trasy tylko na poziomie glownym',
    (_nazwa, sciezka) => {
      const deklaracje = readFileSync(sciezka, 'utf8')
        .split('\n')
        .map((linia, index) => ({ linia, numer: index + 1, dopasowanie: DEKLARACJA_TRASY.exec(linia) }))
        .filter((wpis) => wpis.dopasowanie !== null);

      // Plik z trasami w funkcji fabrykujacej ma je wciete wszystkie i to jest
      // poprawne. Blad wychodzi dopiero wtedy, gdy w jednym pliku sa oba style:
      // wtedy ta wcieta trasa siedzi w ciele innej trasy.
      const naPoziomieGlownym = deklaracje.some((w) => w.dopasowanie![1].length === 0);
      if (!naPoziomieGlownym) return;

      const zagniezdzone = deklaracje
        .filter((w) => w.dopasowanie![1].length > 0)
        .map((w) => `linia ${w.numer}: ${w.linia.trim()}`);

      expect(zagniezdzone).toEqual([]);
    }
  );
});
