import z from 'zod';

/**
 * Medical History Configuration Types
 *
 * These types define the contract for medical history quick picks configuration,
 * including medical conditions, allergies, medications, and in-house medications.
 */

/**
 * Medical condition quick pick item
 */
export interface MedicalConditionQuickPick {
  code?: string;
  display: string;
}

export const MedicalConditionQuickPickSchema: z.ZodType<MedicalConditionQuickPick, z.ZodTypeDef, unknown> = z.object({
  code: z.string().optional(),
  display: z.string().min(1),
});

/**
 * Allergy quick pick item
 */
export interface AllergyQuickPick {
  name: string;
  id?: number;
}

export const AllergyQuickPickSchema: z.ZodType<AllergyQuickPick, z.ZodTypeDef, unknown> = z.object({
  name: z.string().min(1),
  id: z.number().optional(),
});

/**
 * Medication quick pick item
 */
export interface MedicationQuickPick {
  name: string;
  strength?: string;
  id: number;
}

export const MedicationQuickPickSchema: z.ZodType<MedicationQuickPick, z.ZodTypeDef, unknown> = z.object({
  name: z.string().min(1),
  strength: z.string().optional(),
  id: z.number(),
});

/**
 * In-house medication quick pick item
 */
export interface InHouseMedicationQuickPick {
  name: string;
  dosespotId: number;
  dose?: number;
  units?: string;
  route?: string;
  instructions?: string;
}

export const InHouseMedicationQuickPickSchema: z.ZodType<InHouseMedicationQuickPick, z.ZodTypeDef, unknown> = z.object({
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
  quickPicks: MedicalConditionQuickPick[];
}

/**
 * Allergies section
 */
export interface AllergiesSection {
  quickPicks: AllergyQuickPick[];
}

/**
 * Medications section
 */
export interface MedicationsSection {
  quickPicks: MedicationQuickPick[];
}

/**
 * In-house medications section
 */
export interface InHouseMedicationsSection {
  quickPicks: InHouseMedicationQuickPick[];
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
    quickPicks: z.array(MedicalConditionQuickPickSchema).default([]),
  }),
  allergies: z.object({
    quickPicks: z.array(AllergyQuickPickSchema).default([]),
  }),
  medications: z.object({
    quickPicks: z.array(MedicationQuickPickSchema).default([]),
  }),
  inHouseMedications: z.object({
    quickPicks: z.array(InHouseMedicationQuickPickSchema).default([]),
  }),
});
