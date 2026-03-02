import z from 'zod';

/**
 * Medical History Configuration Types
 *
 * These types define the contract for medical history favorites configuration,
 * including medical conditions, allergies, medications, and in-house medications.
 */

/**
 * Medical condition favorite item
 */
export interface MedicalConditionFavorite {
  code?: string;
  display: string;
}

export const MedicalConditionFavoriteSchema: z.ZodType<MedicalConditionFavorite, z.ZodTypeDef, unknown> = z.object({
  code: z.string().optional(),
  display: z.string().min(1),
});

/**
 * Allergy favorite item
 */
export interface AllergyFavorite {
  name: string;
  id?: number;
}

export const AllergyFavoriteSchema: z.ZodType<AllergyFavorite, z.ZodTypeDef, unknown> = z.object({
  name: z.string().min(1),
  id: z.number().optional(),
});

/**
 * Medication favorite item
 */
export interface MedicationFavorite {
  name: string;
  strength?: string;
  id: number;
}

export const MedicationFavoriteSchema: z.ZodType<MedicationFavorite, z.ZodTypeDef, unknown> = z.object({
  name: z.string().min(1),
  strength: z.string().optional(),
  id: z.number(),
});

/**
 * In-house medication favorite item
 */
export interface InHouseMedicationFavorite {
  name: string;
  dosespotId: number;
  dose?: number;
  units?: string;
  route?: string;
  instructions?: string;
}

export const InHouseMedicationFavoriteSchema: z.ZodType<InHouseMedicationFavorite, z.ZodTypeDef, unknown> = z.object({
  name: z.string().min(1),
  dosespotId: z.number(),
  dose: z.number().optional(),
  units: z.string().optional(),
  route: z.string().optional(),
  instructions: z.string().optional(),
});

/**
 * Medical conditions section
 */
export interface MedicalConditionsSection {
  favorites: MedicalConditionFavorite[];
}

/**
 * Allergies section
 */
export interface AllergiesSection {
  favorites: AllergyFavorite[];
}

/**
 * Medications section
 */
export interface MedicationsSection {
  favorites: MedicationFavorite[];
}

/**
 * In-house medications section
 */
export interface InHouseMedicationsSection {
  favorites: InHouseMedicationFavorite[];
}

/**
 * Full medical history configuration
 */
export interface MedicalHistoryConfig {
  medicalConditions: MedicalConditionsSection;
  allergies: AllergiesSection;
  medications: MedicationsSection;
  inHouseMedications: InHouseMedicationsSection;
}

export const MedicalHistoryConfigSchema: z.ZodType<MedicalHistoryConfig, z.ZodTypeDef, unknown> = z.object({
  medicalConditions: z.object({
    favorites: z.array(MedicalConditionFavoriteSchema).default([]),
  }),
  allergies: z.object({
    favorites: z.array(AllergyFavoriteSchema).default([]),
  }),
  medications: z.object({
    favorites: z.array(MedicationFavoriteSchema).default([]),
  }),
  inHouseMedications: z.object({
    favorites: z.array(InHouseMedicationFavoriteSchema).default([]),
  }),
});
