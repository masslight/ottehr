import DOMPurify from 'dompurify';
import { decodeRadiologyReportHtml } from 'utils/lib/fhir/radiology';

/** Formatting a radiology report plausibly carries. */
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
 * Table spans only. They are integers describing layout, so they carry no URL or handler, and a table sent
 * with merged cells would otherwise render with its columns out of line. Everything else — `style`, `class`,
 * `href`, any `on*` — is dropped.
 */
const ALLOWED_REPORT_ATTR = ['colspan', 'rowspan'];

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
    ALLOWED_ATTR: ALLOWED_REPORT_ATTR,
  });
