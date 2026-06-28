import Oystehr from '@oystehr/sdk';
import { Basic } from 'fhir/r4b';
import sanitizeHtml from 'sanitize-html';
import {
  ALLOWED_SUPPORT_DIALOG_TAGS,
  GetSupportDialogOutput,
  SUPPORT_DIALOG_BASIC_TAG,
  SUPPORT_DIALOG_BODY_HTML_EXTENSION_URL,
} from 'utils';

const SUPPORT_DIALOG_SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: ALLOWED_SUPPORT_DIALOG_TAGS,
  allowedAttributes: {},
  allowedSchemes: [],
  disallowedTagsMode: 'discard',
};

export function sanitizeSupportDialogHtml(bodyHtml: string): string {
  return sanitizeHtml(bodyHtml, SUPPORT_DIALOG_SANITIZE_OPTIONS);
}

export async function getSupportDialogPayload(oystehr: Oystehr): Promise<GetSupportDialogOutput> {
  const basicSearch = (
    await oystehr.fhir.search<Basic>({
      resourceType: 'Basic',
      params: [{ name: '_tag', value: `${SUPPORT_DIALOG_BASIC_TAG.system}|${SUPPORT_DIALOG_BASIC_TAG.code}` }],
    })
  ).unbundle();

  const basic = basicSearch.find((r): r is Basic => r.resourceType === 'Basic');
  const storedBodyHtml =
    basic?.extension?.find((e) => e.url === SUPPORT_DIALOG_BODY_HTML_EXTENSION_URL)?.valueString ?? '';

  return { bodyHtml: sanitizeSupportDialogHtml(storedBodyHtml) };
}
