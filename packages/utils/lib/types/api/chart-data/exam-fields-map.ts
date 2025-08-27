// cSpell:ignore abletobearweight, decreasedrom, lowerleg, upperarm
import { CodeableConcept } from 'fhir/r4b';

export function createCodingCode(code: string, display?: string, system?: string): CodeableConcept {
  return {
    coding: [
      {
        code: code,
        display: display ?? undefined,
        system: system ?? undefined,
      },
    ],
  };
}
