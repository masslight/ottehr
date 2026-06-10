import { encountersDataset } from './encountersDataset';
import { AdHocDataset } from './types';

// The selectable-dataset registry. v1 ships Encounters only; adding a source later is just another
// entry here (with its own fetch + schema) — the LLM + iframe pipeline is unchanged.
export const AD_HOC_DATASETS: AdHocDataset[] = [encountersDataset];

export function getDataset(id: string): AdHocDataset | undefined {
  return AD_HOC_DATASETS.find((d) => d.id === id);
}
