// Stands in for packages/zambdas/src/shared/helpers.ts, so a brand can live in another module.
import Oystehr from '@oystehr/sdk';

declare const clinicalScope: unique symbol;

export interface ClinicalOystehr extends Oystehr {
  readonly [clinicalScope]: true;
}

export function createClinicalClient(): ClinicalOystehr {
  return new Oystehr({}) as ClinicalOystehr;
}
