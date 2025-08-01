import { MedicationInteractions } from 'utils';

export function interactionsSummary(interactions: MedicationInteractions): string {
  const names: string[] = [];
  interactions?.drugInteractions
    ?.flatMap((drugInteraction) => drugInteraction.drugs.map((drug) => drug.name))
    ?.forEach((name) => names.push(name));
  if ((interactions?.allergyInteractions?.length ?? 0) > 0) {
    names.push('Allergy');
  }
  return names.join(', ');
}
