import DOMPurify from 'dompurify';
import { decodeRadiologyReportHtml } from 'utils/lib/fhir/radiology';

/**
 * Inline formatting a radiology report plausibly carries. No attributes are allowed through, so there is
 * nowhere for a style, a URL or an event handler to ride along.
 */
const ALLOWED_REPORT_TAGS = [
  'b',
  'strong',
  'i',
  'em',
  'u',
  's',
  'sub',
  'sup',
  'br',
  'p',
  'div',
  'span',
  'ul',
  'ol',
  'li',
  'table',
  'thead',
  'tbody',
  'tr',
  'th',
  'td',
];

/**
 * A stored read, ready to render: decoded from base64 and sanitized.
 *
 * The read is displayed as the radiologist sent it — italicised findings and paragraphs survive — but a final
 * read arrives from AdvaPACS, so it is content we neither author nor validate. Sanitizing keeps the
 * formatting and drops anything executable, which stripping the markup altogether also achieved but at the
 * cost of the formatting.
 */
export const safeRadiologyReportHtml = (report: string): string =>
  DOMPurify.sanitize(decodeRadiologyReportHtml(report), {
    ALLOWED_TAGS: ALLOWED_REPORT_TAGS,
    ALLOWED_ATTR: [],
  });
