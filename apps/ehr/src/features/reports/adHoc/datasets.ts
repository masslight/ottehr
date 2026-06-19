import { adhocEncountersDataset } from './adhocEncountersDataset';
import { billingDataset } from './billingDataset';
import { patientsDataset } from './patientsDataset';
import { AdHocDataset } from './types';

// The selectable-dataset registry. Adding a source is just another entry here (with its own fetch +
// schema) — the LLM + iframe pipeline is unchanged. Encounters (one row per encounter) is the default;
// Patients is the patient-centric source (one row per patient); Billing is the encounter-grain,
// revenue/insurance-focused source.
export const AD_HOC_DATASETS: AdHocDataset[] = [adhocEncountersDataset, patientsDataset, billingDataset];

export function getDataset(id: string): AdHocDataset | undefined {
  return AD_HOC_DATASETS.find((d) => d.id === id);
}

// The OTHER registered datasets (label + description), so a report can point the user to a different
// dataset when the active one can't carry a requested concept. Used to enrich the schema descriptor.
export function otherDatasetsFor(id: string): { label: string; description: string }[] {
  return AD_HOC_DATASETS.filter((d) => d.id !== id).map((d) => ({ label: d.label, description: d.description }));
}
