import { PrepopulationEntry, ProceduresConfig, ProceduresConfigSchema } from 'config-types';
import { PROCEDURES_CONFIG_OVERRIDE } from '../../../ottehr-config-overrides/procedures';
import { mergeAndFreezeConfigObjects } from '../helpers';

const DEFAULT_PROCEDURES_CONFIG = {
  prepopulation: {} as Record<string, PrepopulationEntry>,
  quickPicks: [
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
    {
      name: 'Subungual Hematoma drainage, finger/toe nail',
      procedureType: 'nail-trephination',
      cptCodes: [
        {
          code: '11740',
          display: 'Removal of blood accumulation under fingernail or toenail',
        },
      ],
      suppliesUsed: ['Other'],
      otherSuppliesUsed: 'Cauterize pen',
      complications: 'None',
      patientResponse: 'Tolerated Well',
      postInstructions: ['Return if worsening'],
    },
  ],
} as const satisfies ProceduresConfig;

const mergedConfig = mergeAndFreezeConfigObjects(DEFAULT_PROCEDURES_CONFIG, PROCEDURES_CONFIG_OVERRIDE);

export const PROCEDURES_CONFIG = ProceduresConfigSchema.parse(mergedConfig) as typeof mergedConfig;
