import { codeCandidateFrom } from '../family-support';

export const EKG_CODES = {
  tracingWithInterpretation: '93000',
  tracingOnly: '93005',
  interpretationOnly: '93010',
} as const;

export type EkgCode = (typeof EKG_CODES)[keyof typeof EKG_CODES];

export const EKG_CODE_DISPLAYS = {
  [EKG_CODES.tracingWithInterpretation]:
    'Electrocardiogram, routine ECG with at least 12 leads; with interpretation and report',
  [EKG_CODES.tracingOnly]:
    'Electrocardiogram, routine ECG with at least 12 leads; tracing only, without interpretation and report',
  [EKG_CODES.interpretationOnly]:
    'Electrocardiogram, routine ECG with at least 12 leads; interpretation and report only',
} as const satisfies Record<EkgCode, string>;

export function isEkgCode(code: string): code is EkgCode {
  return code in EKG_CODE_DISPLAYS;
}

export const codeCandidate = codeCandidateFrom(EKG_CODE_DISPLAYS);

export const INTERPRETATION_CODES: readonly string[] = [
  EKG_CODES.tracingWithInterpretation,
  EKG_CODES.interpretationOnly,
];
