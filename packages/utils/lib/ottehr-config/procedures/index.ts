import { z } from 'zod';
import { PROCEDURES_CONFIG_OVERRIDE } from '../../../ottehr-config-overrides/procedures';
import { mergeAndFreezeConfigObjects } from '../helpers';

const DEFAULT_PROCEDURES_CONFIG: ProceduresConfig = {
  prepopulation: {},
  favorites: [
    {
      name: 'X-ray of knee; 3 views',
      procedureType: 'x-ray',
      cptCodes: [
        {
          code: '73562',
          display: 'X-ray of knee, 3 views',
        },
      ],
      bodySite: 'Leg',
      complications: 'None',
      patientResponse: 'Tolerated Well',
      postInstructions: ['Further details, consultation or follow-up imaging may be obtained as clinically indicated '],
    },
  ],
};

const mergedConfig = mergeAndFreezeConfigObjects(DEFAULT_PROCEDURES_CONFIG, PROCEDURES_CONFIG_OVERRIDE);

const PrepopulationEntry = z.record(z.union([z.string(), z.array(z.string()), z.boolean()]));

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
  suppliesUsed: z.array(z.string().optional()).optional(),
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

const ProceduresConfigSchema = z.object({
  prepopulation: z.record(PrepopulationEntry),
  favorites: z.array(FavoriteEntry),
});

type ProceduresConfig = z.infer<typeof ProceduresConfigSchema>;

export const PROCEDURES_CONFIG = ProceduresConfigSchema.parse(mergedConfig);
