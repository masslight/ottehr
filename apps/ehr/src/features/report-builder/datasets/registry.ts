import { billingDataset } from './billing';
import { adhocEncountersDataset } from './encounters';
import { patientsDataset } from './patients';
import { AdHocDataset } from './types';

// Selectable-dataset registry. A new source is just another entry here.
export const AD_HOC_DATASETS: AdHocDataset[] = [adhocEncountersDataset, patientsDataset, billingDataset];

export function getDataset(id: string): AdHocDataset | undefined {
  return AD_HOC_DATASETS.find((d) => d.id === id);
}

// The other registered datasets (label + description), so a report can point the user elsewhere when
// the active dataset can't carry a requested concept. Enriches the schema descriptor.
export function otherDatasetsFor(id: string): { label: string; description: string }[] {
  return AD_HOC_DATASETS.filter((d) => d.id !== id).map((d) => ({ label: d.label, description: d.description }));
}
