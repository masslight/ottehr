import { z } from 'zod';

/**
 * What a lot of vaccine was paid with: the federal Vaccines for Children program (VFC), private purchase, or
 * another public (state) program. A practice keeps and counts each of these stocks apart.
 */
export const VACCINE_FUNDING_SOURCES = ['vfc', 'private', 'state'] as const;
export type VaccineFundingSource = (typeof VACCINE_FUNDING_SOURCES)[number];
export const VACCINE_FUNDING_SOURCE_LABELS: Record<VaccineFundingSource, string> = {
  vfc: 'VFC',
  private: 'Private',
  state: 'State program',
};
export const VaccineFundingSourceSchema = z.enum(VACCINE_FUNDING_SOURCES);
