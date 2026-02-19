import { z } from 'zod';

const MedicalConditionFavoriteSchema = z.object({
  code: z.string().optional(),
  display: z.string().min(1, 'Display is required'),
});

const AllergyFavoriteSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  id: z.number().optional(),
});

const MedicationFavoriteSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  strength: z.string().optional(),
  id: z.number(),
});

const InHouseMedicationFavoriteSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  dosespotId: z.number(),
  dose: z.number().optional(),
  units: z.string().optional(),
  route: z.string().optional(),
  instructions: z.string().optional(),
});

const MedicalHistoryConfigSchema = z.object({
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

export type MedicalConditionFavorite = z.infer<typeof MedicalConditionFavoriteSchema>;
export type AllergyFavorite = z.infer<typeof AllergyFavoriteSchema>;
export type MedicationFavorite = z.infer<typeof MedicationFavoriteSchema>;
export type InHouseMedicationFavorite = z.infer<typeof InHouseMedicationFavoriteSchema>;
export type MedicalHistoryConfig = z.infer<typeof MedicalHistoryConfigSchema>;

export const validateMedicalHistoryConfig = (config: unknown): MedicalHistoryConfig => {
  return MedicalHistoryConfigSchema.parse(config) as MedicalHistoryConfig;
};
