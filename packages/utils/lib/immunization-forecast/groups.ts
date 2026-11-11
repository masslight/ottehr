import { ImmunizationGroupId } from './types';

/**
 * Output lanes and how they map onto the CDSi vaccine groups. Pneumococcal and RSV each hold a childhood and
 * an adult series group in one CDSi vaccine group; the UI shows them as separate lanes, so `seriesGroups`
 * restricts which CDSi series groups feed a lane.
 */
export interface ForecastGroupDefinition {
  id: ImmunizationGroupId;
  label: string;
  /** CDSi vaccine group name (ScheduleSupportingData vaccineGroupToAntigenMap). */
  vaccineGroup: string;
  /** CDSi series group numbers included; undefined = all. */
  seriesGroups?: number[];
  /** Seasonal lanes repeat every season; their target reads "Every season". */
  seasonal?: boolean;
  /**
   * Target shown for the lane when the series name does not say "N-dose" (the DTaP/Tdap/Td series carry 11
   * target doses of which most are age-conditional alternates).
   */
  targetDoses?: number;
  targetText?: string;
}

export const FORECAST_GROUPS: ForecastGroupDefinition[] = [
  { id: 'hepb', label: 'Hep B', vaccineGroup: 'HepB' },
  { id: 'rota', label: 'Rotavirus', vaccineGroup: 'Rotavirus' },
  {
    id: 'dtap',
    label: 'DTaP/Tdap/Td',
    vaccineGroup: 'DTaP/Tdap/Td',
    targetDoses: 5,
    targetText: '5, then Tdap at 11–12 y',
  },
  { id: 'hib', label: 'Hib', vaccineGroup: 'Hib' },
  { id: 'pcv', label: 'PCV', vaccineGroup: 'Pneumococcal', seriesGroups: [1] },
  { id: 'ipv', label: 'Polio', vaccineGroup: 'Polio' },
  { id: 'rsv', label: 'RSV antibody', vaccineGroup: 'RSV', seriesGroups: [1] },
  { id: 'flu', label: 'Influenza', vaccineGroup: 'Influenza', seasonal: true },
  { id: 'covid', label: 'COVID-19', vaccineGroup: 'COVID-19', seasonal: true },
  { id: 'mmr', label: 'MMR', vaccineGroup: 'MMR' },
  { id: 'var', label: 'Varicella', vaccineGroup: 'Varicella' },
  { id: 'hepa', label: 'Hep A', vaccineGroup: 'HepA' },
  { id: 'hpv', label: 'HPV', vaccineGroup: 'HPV' },
  { id: 'menacwy', label: 'MenACWY', vaccineGroup: 'Meningococcal' },
  { id: 'menb', label: 'MenB', vaccineGroup: 'Meningococcal B' },
  { id: 'zoster', label: 'Zoster', vaccineGroup: 'Zoster' },
  { id: 'pneumo-adult', label: 'Pneumococcal (adult)', vaccineGroup: 'Pneumococcal', seriesGroups: [3] },
  { id: 'rsv-adult', label: 'RSV (adult)', vaccineGroup: 'RSV', seriesGroups: [3] },
];

export const FORECAST_GROUP_IDS: ImmunizationGroupId[] = FORECAST_GROUPS.map((g) => g.id);
