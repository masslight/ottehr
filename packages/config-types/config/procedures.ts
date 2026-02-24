import z from 'zod';

/**
 * Procedures Configuration Types
 *
 * These types define the contract for procedure prepopulation configuration,
 * allowing default values to be set for various procedure fields.
 */

/**
 * Value types that can be prepopulated for a procedure field
 */
export type PrepopulationValue = string | string[] | boolean;

/**
 * Prepopulation entry for a single procedure
 */
export type PrepopulationEntry = Record<string, PrepopulationValue>;

export const PrepopulationEntrySchema: z.ZodType<PrepopulationEntry, z.ZodTypeDef, unknown> = z.record(
  z.union([z.string(), z.array(z.string()), z.boolean()])
);

/**
 * Full procedures configuration
 */

const FavoriteEntry = z.object({
  name: z.string(),
  consentObtained: z.boolean().optional(),
  procedureType: z.string().optional(),
  cptCodes: z
    .array(
      z.object({
        code: z.string(),
        display: z.string(),
      })
    )
    .optional(),
  diagnoses: z
    .array(
      z.object({
        code: z.string(),
        display: z.string(),
      })
    )
    .optional(),
  performerType: z.string().optional(),
  medicationUsed: z.string().optional(),
  bodySite: z.string().optional(),
  otherBodySite: z.string().optional(),
  bodySide: z.string().optional(),
  technique: z.string().optional(),
  suppliesUsed: z.array(z.string().optional()),
  otherSuppliesUsed: z.string().optional(),
  procedureDetails: z.string().optional(),
  specimenSent: z.boolean().optional(),
  complications: z.string().optional(),
  otherComplications: z.string().optional(),
  patientResponse: z.string().optional(),
  postInstructions: z.array(z.string()).optional(),
  otherPostInstructions: z.string().optional(),
  timeSpent: z.string().optional(),
  documentedBy: z.string().optional(),
});
export interface ProceduresConfig {
  prepopulation: Record<string, PrepopulationEntry>;
  favorites: z.infer<typeof FavoriteEntry>[];
}

export const ProceduresConfigSchema: z.ZodType<ProceduresConfig, z.ZodTypeDef, unknown> = z.object({
  prepopulation: z.record(PrepopulationEntrySchema),
  favorites: z.array(FavoriteEntry),
});
