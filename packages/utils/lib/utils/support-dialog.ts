import type { Location } from 'fhir/r4b';

export const SUPPORT_DIALOG_BASIC_TAG = {
  system: 'support-config',
  code: 'support-dialog-body',
};

export const SUPPORT_DIALOG_BODY_HTML_EXTENSION_URL = 'https://fhir.ottehr.com/Extension/support-dialog-body-html';

export const LOCATION_SUPPORT_PHONE_EXTENSION_URL = 'https://fhir.ottehr.com/Extension/support-phone-number';

export function getSupportPhoneFor(
  locationName: string | undefined,
  phonesByLocationName: Record<string, string>,
  defaultPhone?: string
): string | undefined {
  if (!locationName) return defaultPhone;
  return phonesByLocationName[locationName] ?? defaultPhone;
}

export function buildLocationSupportPhonesMap(locations: Location[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const loc of locations) {
    if (!loc.name) continue;
    const phone = loc.extension?.find((e) => e.url === LOCATION_SUPPORT_PHONE_EXTENSION_URL)?.valueString;
    if (phone) map[loc.name] = phone;
  }
  return map;
}
