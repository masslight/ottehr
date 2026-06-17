import { adhocEncountersDataset } from './adhocEncountersDataset';
import { encountersDataset } from './encountersDataset';
import { recentPatientsDataset } from './recentPatientsDataset';
import { AdHocDataset } from './types';

// The selectable-dataset registry. Adding a source is just another entry here (with its own fetch +
// schema) — the LLM + iframe pipeline is unchanged. The comprehensive encounters dataset is the
// default; the original Encounters and Recent Patients remain for lighter/back-compat use.
export const AD_HOC_DATASETS: AdHocDataset[] = [adhocEncountersDataset, encountersDataset, recentPatientsDataset];

export function getDataset(id: string): AdHocDataset | undefined {
  return AD_HOC_DATASETS.find((d) => d.id === id);
}
