import { ErxDirectoryPharmacy, ErxDirectoryQuery, PharmacySearchResult } from '../types/api/erx-search.types';
import { PlacesAddressComponents } from '../types/data/search-places';

/** A pharmacy's name and address in parts, as Google's place details give them (or as read from a saved address). */
export type PharmacyPlace = { name: string } & Partial<
  Pick<PlacesAddressComponents, 'streetNumber' | 'streetLong' | 'streetShort' | 'city' | 'stateShort' | 'zipCode'>
>;

/** Long street words and their abbreviations, compared as the abbreviation. */
const ABBREVIATIONS: Record<string, string> = {
  street: 'st',
  avenue: 'ave',
  boulevard: 'blvd',
  road: 'rd',
  drive: 'dr',
  north: 'n',
  south: 's',
  east: 'e',
  west: 'w',
  highway: 'hwy',
  parkway: 'pkwy',
};

/** "ste 100", "suite 100", "#100", "unit 4" */
const SUITE = /(?:\b(?:ste|suite|unit)\b\.?|#)\s*[a-z0-9-]+/g;

/** Lower-case words: hyphens, periods and apostrophes join ("H-E-B" is "heb"); other punctuation separates. */
const words = (text: string): string[] =>
  text
    .toLowerCase()
    .replace(/[-.']/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);

/** A street line compared word for word: suite and unit parts dropped, abbreviations made equal. */
export const normalizeStreet = (text: string): string =>
  words(text.toLowerCase().replace(SUITE, ' '))
    .map((word) => ABBREVIATIONS[word] ?? word)
    .join(' ');

const zip5 = (zip: string | undefined): string => (zip ?? '').replace(/\D/g, '').slice(0, 5);

/** A name's words without store numbers ("CVS/PHARMACY #1234" is "cvs pharmacy"). */
const nameWords = (name: string): string[] => words(name).filter((word) => !/\d/.test(word));

/** Loosely the same pharmacy name: one name's words all appear in the other, or they share the brand (first) word. */
export const pharmacyNamesMatch = (a: string, b: string): boolean => {
  const first = nameWords(a);
  const second = nameWords(b);
  if (!first.length || !second.length) return false;
  const within = (some: string[], all: string[]): boolean => some.every((word) => all.includes(word));
  return within(first, second) || within(second, first) || first[0] === second[0];
};

/** The directory row for a place: the same street number, street name and 5-digit zip, and a loosely matching name.
 * None when no row matches, or when several do (ambiguous). */
export const matchDirectoryPharmacy = (
  place: PharmacyPlace,
  rows: ErxDirectoryPharmacy[]
): ErxDirectoryPharmacy | undefined => {
  const number = words(place.streetNumber ?? '').join('');
  const streets = [place.streetShort, place.streetLong].flatMap((street) => (street ? [normalizeStreet(street)] : []));
  const zip = zip5(place.zipCode);
  if (!number || !streets.length || zip.length !== 5) return undefined;
  const matches = rows.filter((row) => {
    const [rowNumber, ...rowStreet] = normalizeStreet(row.address1).split(' ');
    return (
      rowNumber === number &&
      streets.includes(rowStreet.join(' ')) &&
      zip5(row.zipCode) === zip &&
      pharmacyNamesMatch(place.name, row.name)
    );
  });
  return matches.length === 1 ? matches[0] : undefined;
};

/** The directory search for a place: its street number and the first letter of its street, which the directory's
 * "contains" search finds however the street is written ("1200 n" finds "1200 N MAIN ST", "1200 N. MAIN ST" and
 * "1200 NORTH MAIN STREET"; "500 h" finds "500 HWY 290" and "500 HIGHWAY 290"), with its city and state. The
 * matching rules then pick the row. Undefined without a street number and street. */
export const directoryQueryForPlace = (place: PharmacyPlace): ErxDirectoryQuery | undefined => {
  const streetInitial = words(place.streetShort ?? place.streetLong ?? '')[0]?.[0];
  if (!place.streetNumber || !streetInitial) return undefined;
  return {
    address: `${place.streetNumber} ${streetInitial}`,
    ...(place.city ? { city: place.city } : {}),
    ...(place.stateShort && /^[A-Za-z]{2}$/.test(place.stateShort) ? { state: place.stateShort.toUpperCase() } : {}),
  };
};

/** A saved one-line address ("1200 S Congress Ave, Austin, TX 78704, USA") in parts; undefined when it isn't street,
 * city, state and zip. */
export const parseAddressText = (name: string, text: string): PharmacyPlace | undefined => {
  const parts = text
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part && !/^(usa?|united states)$/i.test(part));
  const stateZip = parts.at(-1)?.match(/^([A-Za-z]{2})\s+(\d{5})(?:-?\d{4})?$/);
  const street = parts[0]?.match(/^(\d[\w-]*)\s+(.+)$/);
  if (parts.length < 3 || !stateZip || !street) return undefined;
  return {
    name,
    streetNumber: street[1],
    streetLong: street[2],
    streetShort: street[2],
    city: parts.at(-2),
    stateShort: stateZip[1].toUpperCase(),
    zipCode: stateZip[2],
  };
};

/** A directory row's address on one line. */
export const formatDirectoryAddress = (row: ErxDirectoryPharmacy): string =>
  `${[row.address1, row.address2].filter(Boolean).join(' ')}, ${row.city}, ${row.state} ${zip5(row.zipCode)}`;

/** A directory row as a pharmacy the order can be sent to. Undefined without an NPI: the order needs the
 * pharmacy's 10-digit NPI, so a row without one can't be e-prescribed to. */
export const directoryPharmacyToResult = (row: ErxDirectoryPharmacy): PharmacySearchResult | undefined =>
  row.npi
    ? {
        ncpdpId: row.ncpdpId,
        npi: row.npi,
        name: row.name,
        phone: row.phone ?? '',
        address: formatDirectoryAddress(row),
      }
    : undefined;
