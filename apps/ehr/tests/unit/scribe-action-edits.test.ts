// Editing a generic action row by its wording: what may be edited, and what the edit does to the action.

import { PlannedAction } from 'utils/lib/easy-chart/api';
import { describe, expect, it } from 'vitest';
import {
  actionEditPatch,
  editableActionText,
  withEditedText,
} from '../../src/features/visits/shared/components/scribe-recommendations/actionEdits';

describe('editableActionText', () => {
  it('offers the wording the executor acts on, named for what it is', () => {
    expect(editableActionText({ kind: 'add-exam-finding', display: 'Sinus tenderness' })).toEqual({
      field: 'display',
      value: 'Sinus tenderness',
      label: 'Exam finding',
    });
    expect(editableActionText({ kind: 'set-vital', field: 'vital-temperature', display: '100.4 F' })).toMatchObject({
      field: 'display',
      label: 'Reading',
    });
    expect(editableActionText({ kind: 'add-patient-instruction', text: 'Rest and fluids.' })).toMatchObject({
      field: 'text',
      label: 'Instruction',
    });
    expect(
      editableActionText({ kind: 'set-disposition', dispositionType: 'pcp', text: 'Follow up in 3 days.' })
    ).toMatchObject({ field: 'text', label: 'Disposition note' });
    expect(editableActionText({ kind: 'add-surgical-history', display: 'Appendectomy' })).toMatchObject({
      label: 'Surgery',
    });
    expect(editableActionText({ kind: 'remove-diagnosis', display: 'Viral URI' })).toMatchObject({
      label: 'Item to remove',
    });
  });

  it('offers nothing for a kind whose meaning is a code, or one with no words to edit', () => {
    expect(editableActionText({ kind: 'set-em-code', code: '99213', display: 'Established, low' })).toBeUndefined();
    expect(editableActionText({ kind: 'add-condition', code: 'J45.909', display: 'Asthma' })).toBeUndefined();
    expect(editableActionText({ kind: 'add-cpt', code: '87880' })).toBeUndefined();
    expect(editableActionText({ kind: 'add-exam-finding' })).toBeUndefined();
  });
});

describe('withEditedText', () => {
  const finding: PlannedAction = {
    kind: 'add-exam-finding',
    display: 'Sinus tenderness',
    searchTerms: ['sinus', 'tender'],
    sourceText: 'tender over the sinuses',
  };

  it('replaces the wording, drops the synonyms that described the old one, and keeps the quote', () => {
    expect(withEditedText(finding, ' Maxillary sinus tenderness ')).toEqual({
      kind: 'add-exam-finding',
      display: 'Maxillary sinus tenderness',
      sourceText: 'tender over the sinuses',
    });
  });

  it('is no edit when the wording is unchanged or emptied', () => {
    expect(withEditedText(finding, 'Sinus tenderness')).toBeUndefined();
    expect(withEditedText(finding, '   ')).toBeUndefined();
  });

  it('re-reads an edited vital with the parser the server used, and refuses a reading it cannot read', () => {
    const temperature: PlannedAction = {
      kind: 'set-vital',
      field: 'vital-temperature',
      display: '100.4 F',
      value: 100.4,
      unit: 'F',
      caution: 'no unit was stated; read as °F from the value',
    };
    expect(withEditedText(temperature, '38.2 C')).toMatchObject({ display: '38.2 C', value: 38.2, unit: 'C' });
    // A stated unit clears the caution the guessed one carried.
    expect(withEditedText(temperature, '38.2 C')?.caution).toBeUndefined();
    expect(withEditedText(temperature, 'warm')).toBeUndefined();
    // Nothing survivable reads like this, so it is refused rather than charted.
    expect(withEditedText(temperature, '250 F')).toBeUndefined();

    const pressure: PlannedAction = {
      kind: 'set-vital',
      field: 'vital-blood-pressure',
      display: '118/76',
      systolic: 118,
      diastolic: 76,
    };
    expect(withEditedText(pressure, '122 over 80')).toMatchObject({ systolic: 122, diastolic: 80 });
  });

  it('describes the edited action for its row', () => {
    const edited = withEditedText(finding, 'Frontal sinus tenderness');
    expect(actionEditPatch(edited!)).toEqual({
      action: edited,
      label: 'Adding exam finding: Frontal sinus tenderness',
      secondary: undefined,
    });
    const disposition = withEditedText(
      { kind: 'set-disposition', dispositionType: 'pcp', text: 'Follow up in 3 days.' },
      'Follow up with your PCP in one week.'
    );
    expect(actionEditPatch(disposition!)).toMatchObject({ secondary: 'Follow up with your PCP in one week.' });
  });
});
