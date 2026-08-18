// The swap is a data-model wart that is easy to "fix" by accident. These tests pin it, and pin the
// fact that only two fields are swapped.

import { describe, expect, it } from 'vitest';
import { NOTE_TEXT_FIELDS } from './actions';
import { chartKeyForNoteField, NOTE_FIELD_LABELS, noteFieldForChartKey } from './note-fields';

describe('chartKeyForNoteField', () => {
  // Verified against ProgressNoteDetails, which reads the displayed chief complaint from
  // chartFields.historyOfPresentIllness.text and the displayed HPI from chartFields.chiefComplaint.text.
  it('stores a clinical Chief Complaint under historyOfPresentIllness, and vice versa', () => {
    expect(chartKeyForNoteField('chiefComplaint')).toBe('historyOfPresentIllness');
    expect(chartKeyForNoteField('historyOfPresentIllness')).toBe('chiefComplaint');
  });

  it('leaves every other field alone', () => {
    expect(chartKeyForNoteField('mechanismOfInjury')).toBe('mechanismOfInjury');
    expect(chartKeyForNoteField('ros')).toBe('ros');
    expect(chartKeyForNoteField('medicalDecision')).toBe('medicalDecision');
  });

  it('round-trips every field', () => {
    for (const field of NOTE_TEXT_FIELDS) {
      expect(noteFieldForChartKey(chartKeyForNoteField(field))).toBe(field);
    }
  });

  it('labels every field for the UI', () => {
    for (const field of NOTE_TEXT_FIELDS) {
      expect(NOTE_FIELD_LABELS[field]?.length, `no label for ${field}`).toBeGreaterThan(0);
    }
  });
});
