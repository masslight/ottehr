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
      postInstructions: ['Further details, consultation or follow-up imaging may be obtained as clinically indicated'],
    },
    {
      name: 'X-Ray of ankle, 3 views',
      procedureType: 'x-ray',
      cptCodes: [
        {
          code: '73610',
          display: 'X-ray of ankle, minimum of 3 views',
        },
      ],
      bodySite: 'Leg',
      complications: 'None',
      patientResponse: 'Tolerated Well',
      postInstructions: ['Further details, consultation or follow-up imaging may be obtained as clinically indicated'],
    },
    {
      name: 'X-Ray, finger, 2 views',
      procedureType: 'x-ray',
      cptCodes: [
        {
          code: '73140',
          display: 'X-ray of finger, minimum of 2 views',
        },
      ],
      patientResponse: 'Tolerated Well',
      postInstructions: ['Further details, consultation or follow-up imaging may be obtained as clinically indicated'],
    },
    {
      name: 'X-Ray of hand, 3 views',
      procedureType: 'x-ray',
      cptCodes: [
        {
          code: '73130',
          display: 'X-ray of hand, minimum of 3 views',
        },
      ],
      complications: 'None',
      patientResponse: 'Tolerated Well',
      postInstructions: ['Further details, consultation or follow-up imaging may be obtained as clinically indicated'],
    },
    {
      name: 'Laceration repair > 2.5 cm',
      procedureType: 'laceration-repair',
      cptCodes: [
        {
          code: '12002',
          display: 'Simple repair of surface wound of scalp, neck, underarms, trunk, arms, or legs, 2.6-7.5 cm',
        },
      ],
      medicationUsed: 'Local',
      technique: 'Aseptic',
      suppliesUsed: ['Suture Kit'],
      complications: 'None',
      patientResponse: 'Tolerated Well',
      postInstructions: ['Wound Care, F/U with PCP, Return if worsening [cite: 71]'],
    },
    {
      name: 'Laceration repair < 2 cm',
      procedureType: 'laceration-repair',
      cptCodes: [
        {
          code: '12001',
          display: 'Simple repair of surface wound of scalp, neck, underarms, trunk, arms, or legs, 2.5 cm or less',
        },
      ],
      technique: 'Clean',
      suppliesUsed: ['Other'],
      otherSuppliesUsed: 'Glue and 3 steri strips',
      complications: 'None',
      patientResponse: 'Tolerated Well',
      postInstructions: ['Return if worsening'],
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
