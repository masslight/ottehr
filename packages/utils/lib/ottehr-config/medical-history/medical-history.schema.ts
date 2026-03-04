import { z } from 'zod';

const MedicalConditionQuickPickSchema = z.object({
  code: z.string().optional(),
  display: z.string().min(1, 'Display is required'),
});

const AllergyQuickPickSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  id: z.number(),
});

const MedicationQuickPickSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  strength: z.string().optional(),
  id: z.number(),
});

const InHouseMedicationQuickPickSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  dosespotId: z.number(),
  dose: z.number().optional(),
  units: z.string().optional(),
  route: z.string().optional(),
  instructions: z.string().optional(),
});

const MedicalHistoryConfigSchema = z.object({
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

export type MedicalConditionQuickPick = z.infer<typeof MedicalConditionQuickPickSchema>;
export type AllergyQuickPick = z.infer<typeof AllergyQuickPickSchema>;
export type MedicationQuickPick = z.infer<typeof MedicationQuickPickSchema>;
export type InHouseMedicationQuickPick = z.infer<typeof InHouseMedicationQuickPickSchema>;
export type MedicalHistoryConfig = z.infer<typeof MedicalHistoryConfigSchema>;

export const validateMedicalHistoryConfig = (config: unknown): MedicalHistoryConfig => {
  return MedicalHistoryConfigSchema.parse(config) as MedicalHistoryConfig;
};
