import { describe, expect, it } from 'vitest';
import { procedureFactsFromPageState } from './procedurePageState';

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
