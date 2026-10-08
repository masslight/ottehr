import { describe, expect, it } from 'vitest';
import { isSentenceBlank } from '../suggested-sentences';
import { fillPrescriptionSuggestion, prescriptionDoseForm, prescriptionSuggestions } from './prescription-suggestions';

/** Picks for a suggestion by blank title; blanks not named stay on their default. */
const picksFor = (
  suggestion: ReturnType<typeof prescriptionSuggestions>[number],
  byTitle: Record<string, string>
): (string | undefined)[] =>
  suggestion.segments.map((segment) => (isSentenceBlank(segment) ? byTitle[segment.title] : undefined));

describe('prescriptionDoseForm', () => {
  it.each([
    ['Amoxicillin 500 MG Oral Capsule', 'capsule'],
    ['Azithromycin 250 MG Oral Tablet', 'tablet'],
    ['Ondansetron 4 MG Disintegrating Oral Tablet (ODT)', 'tablet'],
    ['Amoxicillin 400 MG/5ML Oral Suspension', 'liquid'],
    ['Albuterol 90 MCG/ACTUAT Metered Dose Inhaler', 'inhaler'],
    ['Mupirocin 2 % Topical Ointment', undefined],
  ])('%s → %s', (description, form) => {
    expect(prescriptionDoseForm(description)).toBe(form);
  });
});

describe('prescriptionSuggestions', () => {
  it('offers nothing for a dose form it does not know', () => {
    expect(prescriptionSuggestions('Mupirocin 2 % Topical Ointment')).toEqual([]);
  });

  it('starts every blank on one of its own options', () => {
    for (const description of ['Oral Tablet', 'Oral Capsule', 'Oral Suspension', 'Metered Dose Inhaler']) {
      for (const suggestion of prescriptionSuggestions(description)) {
        for (const segment of suggestion.segments.filter(isSentenceBlank)) {
          expect(segment.options).toContain(segment.initial);
        }
      }
    }
  });
});

describe('fillPrescriptionSuggestion', () => {
  const [scheduled, asNeeded] = prescriptionSuggestions('Amoxicillin 500 MG Oral Capsule');

  it('fills the defaults: 1 capsule twice daily for 10 days is 20 capsules', () => {
    expect(fillPrescriptionSuggestion(scheduled, [])).toEqual({
      quantityValue: '20',
      quantityUnit: 'Capsule',
      daysSupply: '10',
      numberOfRefills: '0',
      patientInstructions: 'Take 1 capsule by mouth twice daily for 10 days.',
    });
  });

  it('works the quantity out from the picks', () => {
    const picks = picksFor(scheduled, { Dose: '2 capsules', Frequency: 'three times daily', Duration: '7 days' });
    expect(fillPrescriptionSuggestion(scheduled, picks)).toMatchObject({
      quantityValue: '42',
      daysSupply: '7',
      patientInstructions: 'Take 2 capsules by mouth three times daily for 7 days.',
    });
  });

  it('counts an as-needed frequency at its most frequent', () => {
    expect(fillPrescriptionSuggestion(asNeeded, [])).toMatchObject({
      quantityValue: '20',
      daysSupply: '5',
      patientInstructions: 'Take 1 capsule by mouth every 6 hours as needed for up to 5 days.',
    });
  });

  it('measures liquids in mL', () => {
    const [liquid] = prescriptionSuggestions('Amoxicillin 400 MG/5ML Oral Suspension');
    const picks = picksFor(liquid, { Dose: '7.5 mL' });
    expect(fillPrescriptionSuggestion(liquid, picks)).toMatchObject({
      quantityValue: '150',
      quantityUnit: 'Milliliter',
      patientInstructions: 'Take 7.5 mL by mouth twice daily for 10 days.',
    });
  });

  it('dispenses one inhaler with no days supply', () => {
    const [inhaler] = prescriptionSuggestions('Albuterol 90 MCG/ACTUAT Metered Dose Inhaler');
    expect(fillPrescriptionSuggestion(inhaler, [])).toEqual({
      quantityValue: '1',
      quantityUnit: 'Inhaler',
      daysSupply: '',
      numberOfRefills: '0',
      patientInstructions: 'Inhale 2 puffs every 4 hours as needed for wheezing.',
    });
  });
});
