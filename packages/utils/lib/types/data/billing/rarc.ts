import { RARC_CODE_LIST } from './rarc-codes.generated';
import type { X12CodeListEntry } from './x12-code-list';

// Deliberately not re-exported from the billing barrel: the table is large, so only the screens that
// show or pick remark codes import it (by this path).

// Current X12 remittance advice remark codes (RARC, external code list 411), in X12 order: the codes
// a biller may pick when keying in a remit.
export const RARC_OPTIONS: readonly X12CodeListEntry[] = RARC_CODE_LIST;

const RARC_DESCRIPTIONS = new Map(RARC_CODE_LIST.map(({ code, description }) => [code, description]));

export function rarcDescription(code: string): string | undefined {
  return RARC_DESCRIPTIONS.get(code);
}
