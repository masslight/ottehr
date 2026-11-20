import { z } from 'zod';
import { DerivedVfcEligibility, VFC_ELIGIBILITY_CODES, VfcEligibilityCode } from '../data/immunization/vfc';

/** Read, or confirm, a visit's VFC eligibility. The encounter is the record; staff roles may read any visit's. */
export const VfcEligibilityInputSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('get'), encounterId: z.string().uuid() }),
  z.object({ action: z.literal('confirm'), encounterId: z.string().uuid(), code: z.enum(VFC_ELIGIBILITY_CODES) }),
]);
export type VfcEligibilityInput = z.infer<typeof VfcEligibilityInputSchema>;

export interface ConfirmedVfcEligibility {
  code: VfcEligibilityCode;
  confirmedAt: string;
  confirmedBy?: string;
}

export interface VfcEligibilityResponse {
  /** VFC covers children through 18; for anyone older nothing is shown or stored. */
  applies: boolean;
  /** What the paperwork says, for staff to confirm; absent when it says nothing yet. */
  derived?: DerivedVfcEligibility;
  /** The eligibility recorded for this visit, once someone confirmed it. */
  confirmed?: ConfirmedVfcEligibility;
}
