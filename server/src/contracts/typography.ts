const NBSP = '\u00A0';

// Applied twice: the first pass consumes the separator before a one-letter word,
// so neighbouring orphans ("z a i") need a second sweep.
const ORPHANS = /(^|[\s(„"'\u2013\u2014-])([aiouwzAIOUWZ])[ \t]+/g;

/** Abbreviation or symbol that must stay glued to the value it refers to. */
const LABELLED_VALUE = /\b(nr|ust\.|art\.|pkt|lit\.|poz\.|str\.|tel\.|zob\.|§)[ \t]+/g;

/** Number glued to its unit or to the noun it counts. */
const NUMBER_UNIT =
  /(\d)[ \t]+(zł|gr|dni|dzień|dnia|doba|dobę|doby|godz\.|h|szt\.|km|kg|g|min|%|r\.|k\.c\.|k\.p\.c\.)/g;

/** Digit groups of one number (phone, account, amount) never split across lines. */
const DIGIT_GROUPS = /(\d)[ \t](?=\d)/g;

/**
 * Polish typography for rendered contract text: no one-letter word, label or
 * unit is ever left dangling at the end of a line. Purely presentational —
 * the immutable snapshot keeps plain spaces.
 */
export function pl(text: string): string {
  return text
    .replace(ORPHANS, `$1$2${NBSP}`)
    .replace(ORPHANS, `$1$2${NBSP}`)
    .replace(LABELLED_VALUE, `$1${NBSP}`)
    .replace(NUMBER_UNIT, `$1${NBSP}$2`)
    .replace(DIGIT_GROUPS, `$1${NBSP}`);
}
