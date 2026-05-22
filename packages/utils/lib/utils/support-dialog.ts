import type { Location } from 'fhir/r4b';

export const SUPPORT_DIALOG_BASIC_TAG = {
  system: 'support-config',
  code: 'support-dialog-body',
};

export const SUPPORT_DIALOG_BODY_HTML_EXTENSION_URL = 'https://fhir.ottehr.com/Extension/support-dialog-body-html';

// Allowlist of HTML tags the support dialog rich-text editor is allowed to emit.
// Kept in sync with the tiptap StarterKit nodes/marks used in RichTextEditorField.
// Links are intentionally excluded so admins cannot inject href-based payloads.
export const ALLOWED_SUPPORT_DIALOG_TAGS = [
  'p',
  'br',
  'strong',
  'em',
  's',
  'code',
  'pre',
  'blockquote',
  'ul',
  'ol',
  'li',
  'h2',
  'h3',
  'hr',
];

export const LOCATION_SUPPORT_PHONE_EXTENSION_URL = 'https://fhir.ottehr.com/Extension/support-phone-number';

export function getSupportPhoneFor(
  locationName: string | undefined,
  phonesByLocationName: Record<string, string>
): string | undefined {
  if (!locationName) return undefined;
  return phonesByLocationName[locationName];
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
