import { Cms1500Address, Cms1500PersonName } from '../../../types/data/billing/cms1500.types';

// NUCC print conventions for the CMS-1500 (02/12): upper case, no punctuation in names and addresses,
// no dollar signs or commas in amounts, no decimal point in diagnosis codes.

// Upper-case printable ASCII. Accents are dropped and anything the Courier (WinAnsi) font or an OCR
// scanner can't read becomes a space.
export function toPrintable(value: string | undefined): string {
  if (!value) return '';
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[‘’]/g, "'")
    .replace(/[–—]/g, '-')
    .toUpperCase()
    .replace(/[^\x20-\x7E]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// "M.D." -> "MD", "Main St, Apt #4" -> "MAIN ST APT 4"
function withoutPunctuation(value: string | undefined): string {
  return toPrintable((value ?? '').replace(/[.#]/g, '').replace(/,/g, ' '));
}

// "123 N Main Street 101" rather than "123 N. Main Street, #101".
export function formatAddressLine(...parts: (string | undefined)[]): string {
  return withoutPunctuation(parts.filter(Boolean).join(' '));
}

// Free-form address blocks (carrier block, items 32 and 33) spell out a 9-digit ZIP with its hyphen.
export function formatCityStateZip(address: Cms1500Address | undefined): string {
  if (!address) return '';
  const zip = zipDigits(address.postalCode);
  const formattedZip = zip.length === 9 ? `${zip.slice(0, 5)}-${zip.slice(5)}` : zip;
  return [withoutPunctuation(address.city), withoutPunctuation(address.state), formattedZip].filter(Boolean).join(' ');
}

// Items 2, 4 and 9: "Last Name, First Name, Middle Initial", with a last-name suffix after the last name.
export function formatLastFirstName(name: Cms1500PersonName | undefined): string {
  if (!name) return '';
  const last = [withoutPunctuation(name.last), withoutPunctuation(name.suffix)].filter(Boolean).join(' ');
  const middleInitial = withoutPunctuation(name.middle).charAt(0);
  return [last, withoutPunctuation(name.first), middleInitial].filter(Boolean).join(', ');
}

// Item 17: "First Name, Middle Initial, Last Name" followed by the credentials.
export function formatFirstLastName(name: Cms1500PersonName | undefined, credentials?: string): string {
  if (!name) return '';
  return [
    withoutPunctuation(name.first),
    withoutPunctuation(name.middle).charAt(0),
    withoutPunctuation(name.last),
    withoutPunctuation(name.suffix),
    withoutPunctuation(credentials),
  ]
    .filter(Boolean)
    .join(' ');
}

export interface Cms1500DateParts {
  mm: string;
  dd: string;
  yy: string;
  yyyy: string;
}

// Accepts an ISO date or date-time and reads the calendar date as written, without time zone math.
export function dateParts(value: string | undefined): Cms1500DateParts | undefined {
  const match = value?.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return undefined;
  const [, yyyy, mm, dd] = match;
  return { mm, dd, yy: yyyy.slice(2), yyyy };
}

// Signature dates (items 12 and 31) have no pre-printed separators: MM DD YY.
export function formatShortDate(value: string | undefined): string {
  const parts = dateParts(value);
  return parts ? `${parts.mm} ${parts.dd} ${parts.yy}` : '';
}

export interface Cms1500MoneyParts {
  dollars: string;
  cents: string;
}

export function moneyParts(amount: number | undefined): Cms1500MoneyParts | undefined {
  if (amount == null || !Number.isFinite(amount)) return undefined;
  const totalCents = Math.round(Math.abs(amount) * 100);
  return {
    dollars: `${amount < 0 ? '-' : ''}${Math.floor(totalCents / 100)}`,
    cents: String(totalCents % 100).padStart(2, '0'),
  };
}

// The area code goes inside the pre-printed parentheses; the number has no hyphen or space.
export function phoneParts(value: string | undefined): { areaCode: string; number: string } | undefined {
  const digits = (value ?? '').replace(/\D/g, '');
  const national = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
  if (!national) return undefined;
  if (national.length === 10) return { areaCode: national.slice(0, 3), number: national.slice(3) };
  return { areaCode: '', number: national };
}

// Items 5 and 7: 5 or 9 digits with no hyphen.
export function zipDigits(value: string | undefined): string {
  return (value ?? '').replace(/\D/g, '');
}

// The decimal point in an ICD code is implied, so it isn't printed.
export function formatDiagnosisCode(code: string | undefined): string {
  return toPrintable(code).replace(/[.\s]/g, '');
}

// 24E: up to four reference letters (A-L), primary first, no separators.
export function formatDiagnosisPointers(pointers: number[] | undefined): string {
  return [...new Set(pointers ?? [])]
    .filter((pointer) => Number.isInteger(pointer) && pointer >= 1 && pointer <= 12)
    .slice(0, 4)
    .map((pointer) => String.fromCharCode(64 + pointer))
    .join('');
}

// 24G: left justified with no leading zeros; a decimal point only for fractional units.
export function formatUnits(units: number | undefined): string {
  if (units == null || !Number.isFinite(units)) return '';
  const text = String(Number(units.toFixed(3)));
  return text.startsWith('0.') ? text.slice(1) : text;
}
