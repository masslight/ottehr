import { describe, expect, it } from 'vitest';
import {
  applyProcedurePrepopulation,
  LocalProcedurePageState,
  procedureFactsFromPageState,
} from './procedurePageState';

it('prefills only correctly typed fields and preserves provider answers', () => {
  const state: LocalProcedurePageState = { bodySite: 'Arm', specimenSent: false };
  applyProcedurePrepopulation(state, {
    bodySite: 'Leg',
    specimenSent: true,
    procedureDetails: 'Length:',
    technique: ['Clean'],
    medicationUsed: false,
    suppliesUsed: ['Plaster', 12],
    structuredFacts: 'invalid',
    unknownField: 'ignored',
  });
  expect(state).toEqual({ bodySite: 'Arm', specimenSent: false, procedureDetails: 'Length:', technique: ['Clean'] });
});

describe('procedureFactsFromPageState', () => {
  it('projects the form fields used by coding assistance', () => {
    expect(
      procedureFactsFromPageState(
        {
          performerType: 'Provider',
          documentedBy: 'Provider',
          patientResponse: 'Tolerated well',
          postInstructions: ['Other'],
          otherPostInstructions: 'Splint care and elevation reviewed',
          lengthCm: 3.2,
          repairDepth: 'subcutaneous-layered',
          infusionStartTime: '14:05',
          infusionStopTime: '14:47',
        },
        'Splint Application'
      )
    ).toMatchObject({
      procedureType: 'Splint Application',
      performerType: 'Provider',
      documentedBy: 'Provider',
      patientResponse: 'Tolerated well',
      postInstructions: ['Other: Splint care and elevation reviewed'],
      lengthCm: 3.2,
      repairDepth: 'subcutaneous-layered',
      infusionStartTime: '14:05',
      infusionStopTime: '14:47',
    });
  });

  it('drops an unknown repair-depth value from engine input', () => {
    expect(
      procedureFactsFromPageState({ repairDepth: 'legacy-unknown-depth' }, 'Laceration Repair').repairDepth
    ).toBeUndefined();
  });
});
