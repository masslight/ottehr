import { describe, expect, it } from 'vitest';
import { findAiAddedFor } from '../../src/features/visits/shared/components/scribe-recommendations/aiAddedMarks';
import { ScribeRecommendation } from '../../src/features/visits/shared/components/scribe-recommendations/types';

const applied: ScribeRecommendation[] = [
  { id: 'allergy-1', kind: 'allergy', section: 'allergies', name: 'Penicillin', evidence: 'allergic to penicillin' },
  {
    id: 'dx-1',
    kind: 'diagnosis',
    section: 'assessment',
    code: 'J01.90',
    display: 'Acute sinusitis, unspecified',
    transcriptTerm: 'sinus infection',
  },
];

describe('findAiAddedFor', () => {
  it('matches an allergy by name, ignoring case and whitespace', () => {
    expect(findAiAddedFor(applied, { kind: 'allergy', name: '  penicillin ' })?.id).toBe('allergy-1');
  });

  it('matches a diagnosis by code', () => {
    expect(findAiAddedFor(applied, { kind: 'diagnosis', code: 'J01.90' })?.id).toBe('dx-1');
  });

  it('returns undefined when nothing applied wrote the item', () => {
    expect(findAiAddedFor(applied, { kind: 'allergy', name: 'Sulfa' })).toBeUndefined();
    expect(findAiAddedFor(applied, { kind: 'diagnosis', code: 'J02.9' })).toBeUndefined();
    expect(findAiAddedFor(applied, { kind: 'medication', name: 'Penicillin' })).toBeUndefined();
    expect(findAiAddedFor([], { kind: 'template' })).toBeUndefined();
  });
});
