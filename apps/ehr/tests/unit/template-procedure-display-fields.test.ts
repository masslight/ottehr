import { TemplateProcedurePlan } from 'utils/lib/types/data/admin-template.types';
import { describe, expect, it } from 'vitest';
import { getProcedureDisplayFields } from '../../src/helpers/templates';

const plan = (overrides: Partial<TemplateProcedurePlan>): TemplateProcedurePlan => ({
  planId: 'plan-1',
  procedureType: 'EKG',
  performerType: undefined,
  bodySite: undefined,
  bodySide: undefined,
  technique: [],
  medicationUsed: undefined,
  suppliesUsed: undefined,
  procedureDetails: undefined,
  lengthCm: undefined,
  repairDepth: undefined,
  infusionStartTime: undefined,
  infusionStopTime: undefined,
  specimenSent: undefined,
  complications: undefined,
  patientResponse: undefined,
  postInstructions: undefined,
  timeSpent: undefined,
  documentedBy: undefined,
  consentObtained: undefined,
  diagnoses: [],
  cptCodes: [],
  ...overrides,
});

describe('template procedure display fields', () => {
  it('shows "Both" performers with the same wording as the procedure form and visit note', () => {
    expect(getProcedureDisplayFields(plan({ performerType: 'Both' }))).toContainEqual({
      label: 'Performer type',
      value: 'Provider and healthcare staff',
    });
  });
});
