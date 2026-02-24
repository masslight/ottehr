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
export interface ProceduresConfig {
  prepopulation: Record<string, PrepopulationEntry>;
}

export const ProceduresConfigSchema: z.ZodType<ProceduresConfig, z.ZodTypeDef, unknown> = z.object({
  prepopulation: z.record(PrepopulationEntrySchema),
});
