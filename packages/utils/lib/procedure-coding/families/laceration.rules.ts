import type { ComplexRepairSiteGroup, LacerationRepairClass, LacerationSiteGroup } from './laceration.extract';

export interface CodeBand {
  code: string;
  minCm: number;
  maxCm: number | null;
}

export interface CodeSeries {
  group: LacerationSiteGroup;
  repairClass: LacerationRepairClass;
  classLabel: 'Simple' | 'Intermediate';
  groupLabel: string;
  bands: CodeBand[];
}

export const LACERATION_CODES = {
  simpleTrunkExtremities: {
    upTo2_5Cm: '12001',
    from2_6To7_5Cm: '12002',
    from7_6To12_5Cm: '12004',
    from12_6To20Cm: '12005',
    from20_1To30Cm: '12006',
    over30Cm: '12007',
  },
  simpleFaceMucousMembranes: {
    upTo2_5Cm: '12011',
    from2_6To5Cm: '12013',
    from5_1To7_5Cm: '12014',
    from7_6To12_5Cm: '12015',
    from12_6To20Cm: '12016',
    from20_1To30Cm: '12017',
    over30Cm: '12018',
  },
  intermediateTrunkExtremities: {
    upTo2_5Cm: '12031',
    from2_6To7_5Cm: '12032',
    from7_6To12_5Cm: '12034',
    from12_6To20Cm: '12035',
    from20_1To30Cm: '12036',
    over30Cm: '12037',
  },
  intermediateNeckHandsFeetGenitalia: {
    upTo2_5Cm: '12041',
    from2_6To7_5Cm: '12042',
    from7_6To12_5Cm: '12044',
    from12_6To20Cm: '12045',
    from20_1To30Cm: '12046',
    over30Cm: '12047',
  },
  intermediateFaceMucousMembranes: {
    upTo2_5Cm: '12051',
    from2_6To7_5Cm: '12052',
    from7_6To12_5Cm: '12054',
    from12_6To20Cm: '12055',
    from20_1To30Cm: '12056',
    over30Cm: '12057',
  },
  complexTrunk: { base: '13100', second: '13101', addOn: '13102' },
  complexScalpArmsLegs: { base: '13120', second: '13121', addOn: '13122' },
  complexForeheadNeckHandsFeet: { base: '13131', second: '13132', addOn: '13133' },
  complexEyelidsNoseEarsLips: { base: '13151', second: '13152', addOn: '13153' },
  deletedComplexUpTo1Cm: '13150',
  tissueAdhesiveOnlyMedicare: 'G0168',
} as const;

export const LACERATION_CODE_SERIES: CodeSeries[] = [
  {
    group: 'simple-trunk-extremities',
    repairClass: 'simple',
    classLabel: 'Simple',
    groupLabel: 'scalp/neck/axillae/genitalia/trunk/extremities (including hands and feet)',
    bands: [
      { code: LACERATION_CODES.simpleTrunkExtremities.upTo2_5Cm, minCm: 0, maxCm: 2.5 },
      { code: LACERATION_CODES.simpleTrunkExtremities.from2_6To7_5Cm, minCm: 2.6, maxCm: 7.5 },
      { code: LACERATION_CODES.simpleTrunkExtremities.from7_6To12_5Cm, minCm: 7.6, maxCm: 12.5 },
      { code: LACERATION_CODES.simpleTrunkExtremities.from12_6To20Cm, minCm: 12.6, maxCm: 20.0 },
      { code: LACERATION_CODES.simpleTrunkExtremities.from20_1To30Cm, minCm: 20.1, maxCm: 30.0 },
      { code: LACERATION_CODES.simpleTrunkExtremities.over30Cm, minCm: 30.1, maxCm: null },
    ],
  },
  {
    group: 'simple-face-mm',
    repairClass: 'simple',
    classLabel: 'Simple',
    groupLabel: 'face/ears/eyelids/nose/lips/mucous membranes',
    bands: [
      { code: LACERATION_CODES.simpleFaceMucousMembranes.upTo2_5Cm, minCm: 0, maxCm: 2.5 },
      { code: LACERATION_CODES.simpleFaceMucousMembranes.from2_6To5Cm, minCm: 2.6, maxCm: 5.0 },
      { code: LACERATION_CODES.simpleFaceMucousMembranes.from5_1To7_5Cm, minCm: 5.1, maxCm: 7.5 },
      { code: LACERATION_CODES.simpleFaceMucousMembranes.from7_6To12_5Cm, minCm: 7.6, maxCm: 12.5 },
      { code: LACERATION_CODES.simpleFaceMucousMembranes.from12_6To20Cm, minCm: 12.6, maxCm: 20.0 },
      { code: LACERATION_CODES.simpleFaceMucousMembranes.from20_1To30Cm, minCm: 20.1, maxCm: 30.0 },
      { code: LACERATION_CODES.simpleFaceMucousMembranes.over30Cm, minCm: 30.1, maxCm: null },
    ],
  },
  {
    group: 'intermediate-trunk-extremities',
    repairClass: 'intermediate',
    classLabel: 'Intermediate',
    groupLabel: 'scalp/axillae/trunk/extremities (excluding hands and feet)',
    bands: [
      { code: LACERATION_CODES.intermediateTrunkExtremities.upTo2_5Cm, minCm: 0, maxCm: 2.5 },
      { code: LACERATION_CODES.intermediateTrunkExtremities.from2_6To7_5Cm, minCm: 2.6, maxCm: 7.5 },
      { code: LACERATION_CODES.intermediateTrunkExtremities.from7_6To12_5Cm, minCm: 7.6, maxCm: 12.5 },
      { code: LACERATION_CODES.intermediateTrunkExtremities.from12_6To20Cm, minCm: 12.6, maxCm: 20.0 },
      { code: LACERATION_CODES.intermediateTrunkExtremities.from20_1To30Cm, minCm: 20.1, maxCm: 30.0 },
      { code: LACERATION_CODES.intermediateTrunkExtremities.over30Cm, minCm: 30.1, maxCm: null },
    ],
  },
  {
    group: 'intermediate-neck-hands-feet-genitalia',
    repairClass: 'intermediate',
    classLabel: 'Intermediate',
    groupLabel: 'neck/hands/feet/genitalia',
    bands: [
      { code: LACERATION_CODES.intermediateNeckHandsFeetGenitalia.upTo2_5Cm, minCm: 0, maxCm: 2.5 },
      { code: LACERATION_CODES.intermediateNeckHandsFeetGenitalia.from2_6To7_5Cm, minCm: 2.6, maxCm: 7.5 },
      { code: LACERATION_CODES.intermediateNeckHandsFeetGenitalia.from7_6To12_5Cm, minCm: 7.6, maxCm: 12.5 },
      { code: LACERATION_CODES.intermediateNeckHandsFeetGenitalia.from12_6To20Cm, minCm: 12.6, maxCm: 20.0 },
      { code: LACERATION_CODES.intermediateNeckHandsFeetGenitalia.from20_1To30Cm, minCm: 20.1, maxCm: 30.0 },
      { code: LACERATION_CODES.intermediateNeckHandsFeetGenitalia.over30Cm, minCm: 30.1, maxCm: null },
    ],
  },
  {
    group: 'intermediate-face-mm',
    repairClass: 'intermediate',
    classLabel: 'Intermediate',
    groupLabel: 'face/ears/eyelids/nose/lips/mucous membranes',
    bands: [
      { code: LACERATION_CODES.intermediateFaceMucousMembranes.upTo2_5Cm, minCm: 0, maxCm: 2.5 },
      { code: LACERATION_CODES.intermediateFaceMucousMembranes.from2_6To7_5Cm, minCm: 2.6, maxCm: 7.5 },
      { code: LACERATION_CODES.intermediateFaceMucousMembranes.from7_6To12_5Cm, minCm: 7.6, maxCm: 12.5 },
      { code: LACERATION_CODES.intermediateFaceMucousMembranes.from12_6To20Cm, minCm: 12.6, maxCm: 20.0 },
      { code: LACERATION_CODES.intermediateFaceMucousMembranes.from20_1To30Cm, minCm: 20.1, maxCm: 30.0 },
      { code: LACERATION_CODES.intermediateFaceMucousMembranes.over30Cm, minCm: 30.1, maxCm: null },
    ],
  },
];

export interface IndexedCode {
  series: CodeSeries;
  band: CodeBand;
  bandIndex: number;
}

export const LACERATION_CODE_INDEX: Record<string, IndexedCode> = {};
export const SERIES_BY_GROUP: Record<LacerationSiteGroup, CodeSeries> = {} as Record<LacerationSiteGroup, CodeSeries>;

for (const series of LACERATION_CODE_SERIES) {
  SERIES_BY_GROUP[series.group] = series;
  series.bands.forEach((band, bandIndex) => {
    LACERATION_CODE_INDEX[band.code] = { series, band, bandIndex };
  });
}

export function isLacerationRepairCode(code: string): boolean {
  return Boolean(LACERATION_CODE_INDEX[code]);
}

const DELETED_COMPLEX_CODES: string[] = [LACERATION_CODES.deletedComplexUpTo1Cm];

export function isComplexRepairCode(code: string): boolean {
  return /^13[123]\d{2}$/.test(code) && !DELETED_COMPLEX_CODES.includes(code);
}

export const COMPLEX_REPAIR_MIN_CM = 1.1;
export const COMPLEX_BASE_MAX_CM = 2.5;
export const COMPLEX_SECOND_MIN_CM = 2.6;
export const COMPLEX_SECOND_MAX_CM = 7.5;
export const COMPLEX_ADD_ON_INCREMENT_CM = 5;

export interface ComplexCodeSeries {
  group: ComplexRepairSiteGroup;
  groupLabel: string;
  baseCode: string;
  secondCode: string;
  addOnCode: string;
}

export const COMPLEX_CODE_SERIES: ComplexCodeSeries[] = [
  {
    group: 'complex-trunk',
    groupLabel: 'trunk',
    baseCode: LACERATION_CODES.complexTrunk.base,
    secondCode: LACERATION_CODES.complexTrunk.second,
    addOnCode: LACERATION_CODES.complexTrunk.addOn,
  },
  {
    group: 'complex-scalp-arms-legs',
    groupLabel: 'scalp/arms/legs',
    baseCode: LACERATION_CODES.complexScalpArmsLegs.base,
    secondCode: LACERATION_CODES.complexScalpArmsLegs.second,
    addOnCode: LACERATION_CODES.complexScalpArmsLegs.addOn,
  },
  {
    group: 'complex-forehead-neck-hands-feet',
    groupLabel: 'forehead/cheeks/chin/mouth/neck/axillae/genitalia/hands/feet',
    baseCode: LACERATION_CODES.complexForeheadNeckHandsFeet.base,
    secondCode: LACERATION_CODES.complexForeheadNeckHandsFeet.second,
    addOnCode: LACERATION_CODES.complexForeheadNeckHandsFeet.addOn,
  },
  {
    group: 'complex-eyelids-nose-ears-lips',
    groupLabel: 'eyelids/nose/ears/lips',
    baseCode: LACERATION_CODES.complexEyelidsNoseEarsLips.base,
    secondCode: LACERATION_CODES.complexEyelidsNoseEarsLips.second,
    addOnCode: LACERATION_CODES.complexEyelidsNoseEarsLips.addOn,
  },
];

export type ComplexCodeRole = 'base' | 'second' | 'addOn';

export interface IndexedComplexCode {
  series: ComplexCodeSeries;
  role: ComplexCodeRole;
}

export const COMPLEX_CODE_INDEX: Record<string, IndexedComplexCode> = {};
export const COMPLEX_SERIES_BY_GROUP = {} as Record<ComplexRepairSiteGroup, ComplexCodeSeries>;
for (const series of COMPLEX_CODE_SERIES) {
  COMPLEX_SERIES_BY_GROUP[series.group] = series;
  COMPLEX_CODE_INDEX[series.baseCode] = { series, role: 'base' };
  COMPLEX_CODE_INDEX[series.secondCode] = { series, role: 'second' };
  COMPLEX_CODE_INDEX[series.addOnCode] = { series, role: 'addOn' };
}
