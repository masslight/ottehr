import { CodeCandidate } from '../model.types';

export type BurnExtentClass = 'small' | 'medium' | 'large';

export type BurnDepthClass = 'first-degree' | 'partial-thickness' | 'full-thickness';

const SMALL_BURN_MAX_PERCENT_EXCLUSIVE = 5;
const MEDIUM_BURN_MAX_PERCENT_INCLUSIVE = 10;

export function burnClassForPercent(percent: number): BurnExtentClass {
  if (percent < SMALL_BURN_MAX_PERCENT_EXCLUSIVE) return 'small';
  if (percent <= MEDIUM_BURN_MAX_PERCENT_INCLUSIVE) return 'medium';
  return 'large';
}

export const BURN_TREATMENT_CODES = {
  small: '16020',
  medium: '16025',
  large: '16030',
} as const satisfies Record<BurnExtentClass, string>;

export type BurnTreatmentCode = (typeof BURN_TREATMENT_CODES)[keyof typeof BURN_TREATMENT_CODES];

interface BurnClassInfo {
  code: BurnTreatmentCode;
  display: string;
  coverage: string;
}

export const BURN_CLASS_INFO: Record<BurnExtentClass, BurnClassInfo> = {
  small: {
    code: BURN_TREATMENT_CODES.small,
    display: 'Dressings and/or debridement of partial-thickness burns; small (less than 5% total body surface area)',
    coverage: 'less than 5% TBSA',
  },
  medium: {
    code: BURN_TREATMENT_CODES.medium,
    display:
      'Dressings and/or debridement of partial-thickness burns; medium (eg, whole face or whole extremity, or 5% to 10% total body surface area)',
    coverage: '5% to 10% TBSA',
  },
  large: {
    code: BURN_TREATMENT_CODES.large,
    display:
      'Dressings and/or debridement of partial-thickness burns; large (eg, more than 1 extremity, or greater than 10% total body surface area)',
    coverage: 'greater than 10% TBSA',
  },
};

export const CLASS_FOR_CODE: Record<string, BurnExtentClass> = Object.fromEntries(
  (Object.entries(BURN_CLASS_INFO) as Array<[BurnExtentClass, BurnClassInfo]>).map(([cls, info]) => [info.code, cls])
);

export const BURN_CODE_RANGE = `${BURN_CLASS_INFO.small.code}–${BURN_CLASS_INFO.large.code}`;

export function isBurnTreatmentCode(code: string): code is BurnTreatmentCode {
  return CLASS_FOR_CODE[code] !== undefined;
}

export function codeCandidate(cls: BurnExtentClass): CodeCandidate {
  const info = BURN_CLASS_INFO[cls];
  return { code: info.code, display: `${info.code} — ${info.display}` };
}
