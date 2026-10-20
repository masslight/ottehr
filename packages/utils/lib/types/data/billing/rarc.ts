import { RARC_CODE_LIST } from './rarc-codes.generated';
import type { RemitCodeEntry } from './remit-codes';

// Deliberately not re-exported from the billing barrel: the table is large, so only the screens that
// show or pick remark codes import it (by this path).

// The remittance advice remark codes (RARCs) a biller may pick when keying in a remit, in code order.
export const RARC_OPTIONS: readonly RemitCodeEntry[] = RARC_CODE_LIST;

const RARC_DESCRIPTIONS = new Map(RARC_CODE_LIST.map(({ code, description }) => [code, description]));

export function rarcDescription(code: string): string | undefined {
  return RARC_DESCRIPTIONS.get(code);
}
