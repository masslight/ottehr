import { describe, expect, it } from 'vitest';
import { SECTION_TO_COMMENT_FIELD } from '../../src/features/easy-charting/exam-ros-catalog';
import { inferExamSectionLabel } from '../../src/features/easy-charting/intent-logic';

// When no checkbox leaf exists, the finding goes into the SECTION's free-text comment area —
// this locks the section inference that decides where it lands.
describe('inferExamSectionLabel', () => {
  it.each([
    ["Positive Homan's sign on the left", 'Extremities'],
    ['Diffuse erythema of the left calf and popliteal fossa', 'Extremities'],
    ['Sharp disc margins bilaterally', undefined],
    ['Oropharynx clear without exudate', 'Oral Cavity'],
    ['No jugular venous distension', undefined],
    ['Boggy nasal turbinates', 'Nose'],
  ])('%s → %s', (text, expected) => {
    expect(inferExamSectionLabel(text)).toBe(expected);
  });

  it('every inferred section has a comment field', () => {
    for (const section of ['Extremities', 'Oral Cavity', 'Nose', 'General Appearance']) {
      expect(SECTION_TO_COMMENT_FIELD[section]).toBeTruthy();
    }
  });
});
