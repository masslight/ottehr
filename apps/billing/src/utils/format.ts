import { DateTime } from 'luxon';
import { formatZipcodeForDisplay } from 'utils/lib/helpers/helpers';
import { CMS_PLACE_OF_SERVICE_CODES } from 'utils/lib/helpers/rcm/constants';
import { ServiceFacilityItem } from 'utils/lib/types/data/billing/billing.types';

export function formatDate(iso: string): string {
  const date = DateTime.fromISO(iso, { zone: 'utc' });
  return date.isValid ? date.toFormat('MM/dd/yyyy') : iso;
}

export function formatDateTime(iso: string): string {
  if (!iso) return '-';
  const dateTime = DateTime.fromISO(iso);
  return dateTime.isValid ? dateTime.toLocaleString(DateTime.DATETIME_MED) : iso;
}

const POS_LABEL_BY_CODE = new Map(CMS_PLACE_OF_SERVICE_CODES.map((pos) => [pos.code, pos.display]));

export function placeOfServiceLabel(code?: string): string {
  if (!code) return '';
  const display = POS_LABEL_BY_CODE.get(code);
  return display ? `${code} - ${display}` : code;
}

export function formatFacilityAddress(facility: ServiceFacilityItem | null): string {
  if (!facility) return '';
  const zip = formatZipcodeForDisplay(facility.zip);
  return [facility.addressLine1, facility.addressLine2, facility.city, facility.state, zip].filter(Boolean).join(', ');
}

// Display names are "Last, First".
export function splitDisplayName(name: string): { firstName: string; lastName: string } {
  const parts = name.split(', ');
  return { firstName: parts[1] ?? '', lastName: parts[0] ?? '' };
}

// Returns undefined when every field is blank.
export function buildAddressInput(
  line1: string | null,
  line2: string | null,
  city: string | null,
  state: string | null,
  zip: string | null
): { line1?: string; line2?: string; city?: string; state?: string; postalCode?: string } | undefined {
  const address = {
    ...(line1?.trim() ? { line1: line1.trim() } : {}),
    ...(line2?.trim() ? { line2: line2.trim() } : {}),
    ...(city?.trim() ? { city: city.trim() } : {}),
    ...(state?.trim() ? { state: state.trim().toUpperCase() } : {}),
    ...(zip?.trim() ? { postalCode: zip.trim() } : {}),
  };
  return Object.keys(address).length ? address : undefined;
}

export function formatTaxId(taxId: string): string {
  if (taxId.length < 3) {
    return taxId;
  }
  return taxId.substring(0, 2) + '-' + taxId.substring(2);
}
