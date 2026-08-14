import { render, screen } from '@testing-library/react';
import { patientScreeningQuestionsConfig } from 'utils/lib/ottehr-config/screening-questions';
import { asqLabels } from 'utils/lib/types/api/chart-data/chart-data.constants';
import { NOTE_TYPE, NoteDTO } from 'utils/lib/types/api/chart-data/chart-data.types';
import { ObservationDTO } from 'utils/lib/types/data/screening-questions/types';
import { describe, expect, it } from 'vitest';
import {
  AdditionalQuestionsSection,
  hasAdditionalQuestions,
} from '../../src/features/easy-charting/AdditionalQuestionsSection';

// The easy-chart note's Additional questions block mirrors Review & Sign's
// AdditionalQuestionsContainer: config-driven screening rows, the ASQ status, and screening notes.
describe('AdditionalQuestionsSection', () => {
  // Drive the test from the live screening config so it keeps passing if the config changes.
  const radioField = patientScreeningQuestionsConfig.fields.find((f) => f.type === 'radio');
  if (!radioField) throw new Error('screening config has no radio field to test with');
  const yesObservation = { field: radioField.fhirField, value: true, resourceId: 'obs-1' } as ObservationDTO;
  const [asqValue, asqLabel] = Object.entries(asqLabels)[0];
  const screeningNote: NoteDTO = {
    type: NOTE_TYPE.SCREENING,
    resourceId: 'note-1',
    patientId: 'p1',
    encounterId: 'e1',
    text: 'Screened per protocol.',
    authorId: 'a1',
    authorName: 'Dr. Test',
  };

  it('renders a config question as "question - answer"', () => {
    render(<AdditionalQuestionsSection observations={[yesObservation]} />);
    expect(screen.getByText('Additional questions')).toBeDefined();
    expect(screen.getByText(`${radioField.question} - Yes`)).toBeDefined();
  });

  it('renders the ASQ status and screening notes', () => {
    const asqObservation = { field: 'asq', value: asqValue, resourceId: 'obs-2' } as ObservationDTO;
    render(<AdditionalQuestionsSection observations={[asqObservation]} screeningNotes={[screeningNote]} />);
    expect(screen.getByText(`ASQ - ${asqLabel}`)).toBeDefined();
    expect(screen.getByText('Screening notes')).toBeDefined();
    expect(screen.getByText('Screened per protocol.')).toBeDefined();
  });

  it('hasAdditionalQuestions gates on answered questions, ASQ, or notes', () => {
    expect(hasAdditionalQuestions(undefined, undefined)).toBe(false);
    expect(hasAdditionalQuestions([], [])).toBe(false);
    // An observation for a field outside the screening config (and not ASQ) doesn't count.
    expect(hasAdditionalQuestions([{ field: 'not-a-screening-field', value: true } as ObservationDTO], [])).toBe(false);
    expect(hasAdditionalQuestions([yesObservation], [])).toBe(true);
    expect(hasAdditionalQuestions([{ field: 'asq', value: asqValue } as ObservationDTO], [])).toBe(true);
    expect(hasAdditionalQuestions(undefined, [screeningNote])).toBe(true);
  });
});
