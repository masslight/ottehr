import { ProcedurePageState } from 'utils';
import { describe, expect, it } from 'vitest';
import { applyProcedureQuickPick, buildProcedureQuickPick, mergeProcedureCptCodes } from './procedureQuickPick';

describe('procedure quick pick data transformations', () => {
  it('applies the structured fields used by the selected family', () => {
    const target: ProcedurePageState = {};

    applyProcedureQuickPick(
      target,
      {
        name: 'Laceration',
        lengthCm: 3.2,
        repairDepth: 'subcutaneous-layered',
        infusionStartTime: '14:05',
        infusionStopTime: '14:47',
      },
      'Laceration Repair'
    );

    expect(target).toMatchObject({ lengthCm: 3.2, repairDepth: 'subcutaneous-layered' });
    expect(target.infusionStartTime).toBeUndefined();
    expect(target.infusionStopTime).toBeUndefined();
  });

  it('clears structured values that do not belong to the next family', () => {
    const target: ProcedurePageState = { lengthCm: 3.2, repairDepth: 'subcutaneous-layered' };

    applyProcedureQuickPick(
      target,
      {
        name: 'Infusion',
        infusionStartTime: '14:05',
        infusionStopTime: '14:47',
      },
      'IV Fluid Administration'
    );

    expect(target).toMatchObject({ infusionStartTime: '14:05', infusionStopTime: '14:47' });
    expect(target.lengthCm).toBeUndefined();
    expect(target.repairDepth).toBeUndefined();
  });

  it('updates units on an existing CPT code without duplicating it', () => {
    const target: ProcedurePageState = {
      cptCodes: [{ resourceId: 'existing', code: '13133', display: 'Each additional 5cm', billableUnits: 1 }],
    };

    applyProcedureQuickPick(
      target,
      { name: 'Add-on units', cptCodes: [{ code: '13133', display: 'Each additional 5cm', billableUnits: 2 }] },
      undefined
    );

    expect(target.cptCodes).toEqual([
      { resourceId: 'existing', code: '13133', display: 'Each additional 5cm', billableUnits: 2 },
    ]);
  });

  it('adds every entry from a compound recommendation', () => {
    expect(
      mergeProcedureCptCodes(undefined, [
        { code: '13132', display: 'Complex repair, initial length' },
        { code: '13133', display: 'Each additional 5 cm', billableUnits: 2 },
      ])
    ).toEqual([
      { code: '13132', display: 'Complex repair, initial length' },
      { code: '13133', display: 'Each additional 5 cm', billableUnits: 2 },
    ]);
  });

  it('builds the persisted quick pick from the current procedure state', () => {
    const quickPick = buildProcedureQuickPick(
      {
        cptCodes: [{ code: '13133', display: 'Each additional 5cm', billableUnits: 2 }],
        lengthCm: 2.5,
        repairDepth: 'superficial-single',
        infusionStartTime: '09:00',
        infusionStopTime: '09:45',
        suppliesUsed: ['Other'],
        otherSuppliesUsed: ' custom dressing ',
      },
      '  Procedure preset  ',
      'Laceration Repair',
      [{ name: 'Laceration Repair', code: 'laceration-repair' }]
    );

    expect(quickPick).toMatchObject({
      name: 'Procedure preset',
      procedureType: 'laceration-repair',
      cptCodes: [{ code: '13133', display: 'Each additional 5cm', billableUnits: 2 }],
      lengthCm: 2.5,
      repairDepth: 'superficial-single',
      infusionStartTime: '09:00',
      infusionStopTime: '09:45',
      suppliesUsed: [],
      otherSuppliesUsed: 'custom dressing',
    });
  });
});
