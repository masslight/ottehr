import { describe, expect, it } from 'vitest';
import { NOTE_TEXT_FIELDS } from './actions';
import { chartKeyForNoteField, NOTE_FIELD_LABELS } from './note-fields';

describe('chartKeyForNoteField', () => {
  it('stores a clinical Chief Complaint under historyOfPresentIllness, and vice versa', () => {
    expect(chartKeyForNoteField('chiefComplaint')).toBe('historyOfPresentIllness');
    expect(chartKeyForNoteField('historyOfPresentIllness')).toBe('chiefComplaint');
  });

  it('leaves every other field alone', () => {
    expect(chartKeyForNoteField('mechanismOfInjury')).toBe('mechanismOfInjury');
    expect(chartKeyForNoteField('ros')).toBe('ros');
    expect(chartKeyForNoteField('medicalDecision')).toBe('medicalDecision');
  });

  it('maps every field to a distinct key', () => {
    expect(new Set(NOTE_TEXT_FIELDS.map(chartKeyForNoteField)).size).toBe(NOTE_TEXT_FIELDS.length);
  });

  it('labels every field for the UI', () => {
    for (const field of NOTE_TEXT_FIELDS) {
      expect(NOTE_FIELD_LABELS[field]?.length, `no label for ${field}`).toBeGreaterThan(0);
    }
  });
});
