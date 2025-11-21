// cSpell:ignore abletobearweight, decreasedrom, lowerleg, upperarm
import { CodeableConcept, Coding } from 'fhir/r4b';

export function createCodeableConcept(coding?: Coding[], text?: string): CodeableConcept {
  for (const code of coding ?? []) {
    if (code.code && !code.system) {
      throw new Error('If Coding has a code, then it must have a system for purposes of this helper');
    }
  }
  return {
    coding,
    text,
  };
}
