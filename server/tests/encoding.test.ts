import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Narzedzia, ktore czytaja plik w kodowaniu ANSI i zapisuja go jako UTF-8
 * (np. Get-Content/Set-Content w PowerShell 5.1) zamieniaja polskie znaki na
 * sekwencje w rodzaju "Ĺ‚" czy "Ä™". Kod nadal sie kompiluje i testy przechodza,
 * a klient dostaje maila z "Nie udaĹ‚o siÄ™...". Ten test wychwytuje to od razu.
 */

const KATALOG = join(__dirname, '..', 'src');

// Typowe pary bajtow UTF-8 odczytane jako Windows-1250/1252.
const USZKODZENIE = /Ĺ[‚„›ĺľ]|Ä[™‡…›]|Ă[łęó]|â€[śťžšž]|Å[‚„¼¹›]|Ä…|Ð|Ñ/;

function plikiZrodlowe(katalog: string): string[] {
  return readdirSync(katalog, { withFileTypes: true }).flatMap((wpis) => {
    const sciezka = join(katalog, wpis.name);
    if (wpis.isDirectory()) return plikiZrodlowe(sciezka);
    return wpis.isFile() && /\.tsx?$/.test(sciezka) ? [sciezka] : [];
  });
}

describe('kodowanie plikow zrodlowych', () => {
  const pliki = plikiZrodlowe(KATALOG);

  it('znajduje pliki zrodlowe do sprawdzenia', () => {
    expect(pliki.length).toBeGreaterThan(0);
  });

  it.each(pliki.map((p) => [p.slice(KATALOG.length + 1), p]))(
    '%s ma poprawne polskie znaki',
    (_nazwa, sciezka) => {
      const uszkodzone = readFileSync(sciezka, 'utf8')
        .split('\n')
        .map((linia, index) => ({ linia, numer: index + 1 }))
        .filter(({ linia }) => USZKODZENIE.test(linia))
        .map(({ numer, linia }) => `linia ${numer}: ${linia.trim().slice(0, 100)}`);

      expect(uszkodzone).toEqual([]);
    }
  );
});
