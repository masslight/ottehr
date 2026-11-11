/**
 * Public input/output types of the immunization forecast engine. See ./README.md.
 */

/** Output lanes (vaccine groups) as shown in Flowsheets › Immunizations and the Due today box. */
export type ImmunizationGroupId =
  | 'hepb'
  | 'rota'
  | 'dtap'
  | 'hib'
  | 'pcv'
  | 'pneumo-adult'
  | 'ipv'
  | 'rsv'
  | 'rsv-adult'
  | 'flu'
  | 'covid'
  | 'mmr'
  | 'var'
  | 'hepa'
  | 'hpv'
  | 'menacwy'
  | 'menb'
  | 'zoster';

/** FHIR administrative gender. Only HPV series depend on it. */
export type ForecastPatientSex = 'female' | 'male' | 'other' | 'unknown';

/**
 * Source of an outside (historical) dose, as the CDC NIP001 "Immunization information source" code set used in
 * HL7 RXA-9 and FHIR Immunization.reportOrigin. Decision #5 wording in parentheses.
 */
export const IMMUNIZATION_REPORT_ORIGIN = {
  /** 00 New immunization record (administered here). */
  NEW_RECORD: '00',
  /** 01 Historical information, source unspecified. */
  UNSPECIFIED: '01',
  /** 02 Historical information, from other provider ("another provider's records"). */
  OTHER_PROVIDER: '02',
  /** 03 Historical information, from parent's written record ("a written record"). */
  WRITTEN_RECORD: '03',
  /** 04 Historical information, from parent's recall ("the patient's or family's recall"). */
  RECALL: '04',
  /** 05 Historical information, from other registry ("another registry"). */
  OTHER_REGISTRY: '05',
  /** 06 Historical information, from birth certificate ("a birth certificate"). */
  BIRTH_CERTIFICATE: '06',
  /** 07 Historical information, from school record ("a school record"). */
  SCHOOL_RECORD: '07',
  /** 08 Historical information, from public agency ("a public agency"). */
  PUBLIC_AGENCY: '08',
} as const;

export type ImmunizationReportOrigin = (typeof IMMUNIZATION_REPORT_ORIGIN)[keyof typeof IMMUNIZATION_REPORT_ORIGIN];

export interface ForecastDoseInput {
  /** Caller's id (e.g. the FHIR Immunization id); echoed back on the evaluated dose. */
  id: string;
  /** ISO yyyy-mm-dd, or null when the date is unknown. Undated doses are shown but never counted. */
  date: string | null;
  cvx: string;
  source: 'administered' | 'outside';
  /** NIP001 code; only meaningful for source 'outside'. Missing = '01' (unspecified). */
  outsideSource?: ImmunizationReportOrigin;
}

export type ForecastMarkType = 'immune' | 'contraindicated' | 'declined';

export interface ForecastMarkInput {
  type: ForecastMarkType;
  /** ISO yyyy-mm-dd the mark was made. */
  date: string;
  /** Display name of who made the mark. */
  by: string;
  note?: string;
}

export interface ImmunizationForecastInput {
  /** ISO yyyy-mm-dd. */
  dob: string;
  sex?: ForecastPatientSex;
  /**
   * Country of birth as the CDSi data spells it ("U.S."); default "U.S.". Only used for immunity by date of birth
   * (varicella: born in the U.S. before 1980).
   */
  birthCountry?: string;
  /** Assessment date, ISO yyyy-mm-dd (CDSi "assessment date"); normally today in the practice's time zone. */
  asOf: string;
  doses: ForecastDoseInput[];
  /** Active per-vaccine marks (decision #6, option C). A mark overrides the group's status. */
  marks?: Partial<Record<ImmunizationGroupId, ForecastMarkInput>>;
  /** Restrict the output to these groups; default = every group. */
  groups?: ImmunizationGroupId[];
}

export type ImmunizationGroupStatus =
  | 'notyet'
  | 'uptodate'
  | 'due'
  | 'pastdue'
  | 'complete'
  | 'immune'
  | 'contraindicated'
  | 'declined';

/** CDSi patient series status (logic spec table 7-10), kept for callers who need the fine distinction. */
export type CdsiSeriesStatus = 'Not Complete' | 'Complete' | 'Not Recommended' | 'Aged Out' | 'Immune';

export type EvaluatedDoseStatus = 'valid' | 'invalid' | 'extraneous' | 'not-counted';

export interface DoseWindow {
  earliest: string | null;
  recommended: string | null;
  pastDue: string | null;
}

export interface EvaluatedDose {
  id: string;
  date: string | null;
  cvx: string;
  /** 1-based target dose this dose satisfied in the selected series; null when it did not count. */
  doseNumber: number | null;
  status: EvaluatedDoseStatus;
  /** Short reason for invalid, extraneous or not-counted doses, e.g. "Too young", "Date unknown". */
  reason?: string;
  /** Equivalent to status === 'valid'. */
  counted: boolean;
  /** The window the satisfied target dose was due in, computed from the history before this dose. */
  window?: DoseWindow;
  /** Where the dose fell in its window: early = before recommended, late = after past due. */
  timing?: 'early' | 'on-time' | 'late';
}

export interface NextDose {
  /** 1-based target dose number (CDSi FORECASTDN-1). */
  n: number;
  earliest: string;
  recommended: string;
  /** null when the dose has no past-due date (e.g. seasonal doses). */
  pastDue: string | null;
  /** Last date the dose can be given (max age − 1 day), when the series has one. */
  latest: string | null;
  /** CVX codes the data recommends for this dose at the forecast dates (forecastVaccineType = Y). */
  cvx: string[];
  /** Short explanation for the UI, e.g. the series' administrative guidance. */
  note?: string;
}

export interface ImmunizationGroupForecast {
  group: ImmunizationGroupId;
  label: string;
  status: ImmunizationGroupStatus;
  seriesStatus: CdsiSeriesStatus;
  /** Name(s) of the CDSi series the result is based on, for tooltips and debugging. */
  seriesNames: string[];
  /** Number of target doses in the selected series (skipped doses excluded); null for recurring-only series. */
  targetDoses: number | null;
  /** Display text for the target, e.g. "4", "Every season". */
  targetText: string;
  doses: EvaluatedDose[];
  next: NextDose | null;
  /** 1-based target dose numbers the patient no longer needs (skipped by age or history). */
  notNeeded: number[];
  mark?: ForecastMarkInput;
  /** Plain-language notes: skip reasons, aged out, past season, etc. */
  notes: string[];
}

export interface ImmunizationForecast {
  asOf: string;
  /** Folder name of the rules data used, e.g. "2026-11". */
  dataVersion: string;
  groups: ImmunizationGroupForecast[];
  /** Input doses whose CVX maps to none of the forecast antigens (e.g. travel vaccines); they are listed nowhere else. */
  unmappedDoses: ForecastDoseInput[];
}
