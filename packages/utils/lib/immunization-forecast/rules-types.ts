/**
 * Shape of the converted CDSi supporting data shipped under ./data/<version>/.
 *
 * Field names follow the CDSi XML (AntigenSupportingData.xsd / ScheduleSupportingData.xsd) so the logic
 * specification can be read side by side with the code. Ages and intervals are kept as the CDSi strings
 * ("6 weeks - 4 days", "4 months", "1 day") and parsed at runtime; see ./dates.ts.
 * Empty XML elements are dropped (undefined) rather than carried as "".
 */

export type CdsiDuration = string;

/** CDSi dates are yyyymmdd in the XML; the converter rewrites them to ISO yyyy-mm-dd. */
export type IsoDate = string;

export interface RulesManifest {
  /** Folder name, e.g. "2026-11". Bump when the data is re-converted. */
  version: string;
  generatedAt: string;
  sources: {
    name: string;
    version: string;
    url: string;
    file: string;
    /** Which antigens were taken from this source. */
    antigens: string[];
  }[];
  notes: string[];
}

export interface CvxAntigenAssociation {
  antigen: string;
  beginAge?: CdsiDuration;
  endAge?: CdsiDuration;
}

export interface CvxMapEntry {
  cvx: string;
  shortDescription: string;
  associations: CvxAntigenAssociation[];
}

export interface LiveVirusConflictRule {
  /** CVX of the dose given first (CDSi "previous" / conflicting vaccine type). */
  previousCvx: string;
  /** CVX of the dose being evaluated (CDSi "current" / impacted vaccine type). */
  currentCvx: string;
  conflictBeginInterval: CdsiDuration;
  minConflictEndInterval: CdsiDuration;
  conflictEndInterval: CdsiDuration;
}

export interface VaccineGroupRule {
  name: string;
  antigens: string[];
  administerFullVaccineGroup?: boolean;
}

export interface ScheduleRules {
  cvxToAntigen: CvxMapEntry[];
  liveVirusConflicts: LiveVirusConflictRule[];
  vaccineGroups: VaccineGroupRule[];
}

export interface SeriesAgeRule {
  absMinAge?: CdsiDuration;
  minAge?: CdsiDuration;
  earliestRecAge?: CdsiDuration;
  latestRecAge?: CdsiDuration;
  maxAge?: CdsiDuration;
  effectiveDate?: IsoDate;
  cessationDate?: IsoDate;
}

export interface SeriesIntervalRule {
  fromPrevious: boolean;
  /** 1-based target dose number in the series ("From Target Dose # in Series"). */
  fromTargetDose?: number;
  /** CVX list ("From Most Recent Vaccine Type"). */
  fromMostRecent?: string[];
  /** Observation code ("From Relevant Observation"); not used by this engine (no coded observations). */
  fromRelevantObs?: string;
  absMinInt?: CdsiDuration;
  minInt?: CdsiDuration;
  earliestRecInt?: CdsiDuration;
  latestRecInt?: CdsiDuration;
  /** CDSi intervalPriority "override": the interval wins regardless of the others. */
  priority?: 'override';
  effectiveDate?: IsoDate;
  cessationDate?: IsoDate;
}

export interface AllowableIntervalRule {
  fromPrevious: boolean;
  fromTargetDose?: number;
  absMinInt?: CdsiDuration;
  effectiveDate?: IsoDate;
  cessationDate?: IsoDate;
}

export interface PreferableVaccineRule {
  vaccineType: string;
  cvx: string;
  beginAge?: CdsiDuration;
  endAge?: CdsiDuration;
  tradeName?: string;
  mvx?: string;
  volume?: string;
  forecastVaccineType: boolean;
}

export interface AllowableVaccineRule {
  vaccineType: string;
  cvx: string;
  beginAge?: CdsiDuration;
  endAge?: CdsiDuration;
}

export type SkipConditionType =
  | 'Age'
  | 'Interval'
  | 'Vaccine Count by Age'
  | 'Vaccine Count by Date'
  | 'Vaccine Count by Date and Age'
  | 'Completed Series';

export interface SkipCondition {
  id: number;
  type: SkipConditionType;
  startDate?: IsoDate;
  endDate?: IsoDate;
  beginAge?: CdsiDuration;
  endAge?: CdsiDuration;
  interval?: CdsiDuration;
  doseCount?: number;
  doseType?: 'Valid' | 'Total';
  doseCountLogic?: 'greater than' | 'equal to' | 'less than';
  /** CVX list the counted doses must belong to; empty = any CVX of the antigen. */
  vaccineTypes?: string[];
  /** Series group numbers ("Completed Series"). */
  seriesGroups?: number[];
}

export interface SkipSet {
  id: number;
  description?: string;
  effectiveDate?: IsoDate;
  cessationDate?: IsoDate;
  conditionLogic?: 'AND' | 'OR';
  conditions: SkipCondition[];
}

export interface ConditionalSkipRule {
  context: 'Evaluation' | 'Forecast' | 'Both';
  setLogic?: 'AND' | 'OR';
  sets: SkipSet[];
}

export interface SeriesDoseRule {
  /** "Dose 1", "Dose 2", … (CDSi doseNumber). */
  doseNumber: string;
  ages: SeriesAgeRule[];
  intervals: SeriesIntervalRule[];
  allowableIntervals: AllowableIntervalRule[];
  preferableVaccines: PreferableVaccineRule[];
  allowableVaccines: AllowableVaccineRule[];
  /** CVX codes that are an inadvertent administration for this target dose. */
  inadvertentVaccines: string[];
  conditionalSkips: ConditionalSkipRule[];
  recurringDose: boolean;
  seasonalRecommendation?: { startDate?: IsoDate; endDate?: IsoDate };
}

export interface SeriesSelectRule {
  defaultSeries: boolean;
  productPath: boolean;
  seriesGroupName?: string;
  seriesGroup: number;
  seriesPriority?: string;
  seriesPreference: number;
  minAgeToStart?: CdsiDuration;
  maxAgeToStart?: CdsiDuration;
}

export interface SeriesRule {
  seriesName: string;
  targetDisease: string;
  vaccineGroup: string;
  seriesType: 'Standard' | 'Risk' | 'Evaluation Only';
  /** Series group number this series is equivalent to (CDSi equivalentSeriesGroups), if any. */
  equivalentSeriesGroups?: number[];
  requiredGender?: ('Female' | 'Male' | 'Unknown')[];
  select: SeriesSelectRule;
  /** True when the series needs a coded patient observation (indication); such series are not shipped. */
  requiresIndication: boolean;
  seriesAdminGuidance: string[];
  doses: SeriesDoseRule[];
}

export interface AntigenRules {
  antigen: string;
  /** Source id from the manifest, e.g. "cdc-4.64" or "aira-26.1". */
  source: string;
  /** Evidence of immunity by date of birth (CDSi 7.2), e.g. measles for patients born before 1957. */
  immunity?: {
    birthDate: IsoDate;
    /** Country of birth the rule is limited to (e.g. "U.S." for varicella); undefined = any country. */
    birthCountry?: string;
  };
  series: SeriesRule[];
}
