import { MedicationInteractions } from 'utils';
import { ReasonListCodes, reasonListValues } from './medicationTypes';

export function interactionsSummary(interactions: MedicationInteractions): string {
  const names: string[] = [];
  interactions.drugInteractions
    .flatMap((drugInteraction) => drugInteraction.drugs.map((drug) => drug.name))
    .forEach((name) => names.push(name));
  if (interactions.allergyInteractions.length > 0) {
    names.push('Allergy');
  }
  return names.join(', ');
}

export function formatMedicationAdministrationReason(reason?: string, otherReason?: string): string {
  if (!reason) return '';

  const reasonLabel = reasonListValues[reason as ReasonListCodes] ?? reason.replace(/-/g, ' ');
  const trimmedOtherReason = otherReason?.trim();

  if (reason === ReasonListCodes.OTHER && trimmedOtherReason) {
    return `${reasonLabel}: ${trimmedOtherReason}`;
  }

  return reasonLabel;
}
