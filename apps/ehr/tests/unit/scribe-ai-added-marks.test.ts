import { describe, expect, it } from 'vitest';
import {
  findAiAddedFor,
  templateFilledCard,
} from '../../src/features/visits/shared/components/scribe-recommendations/aiAddedMarks';
import {
  ScribeRecommendation,
  TemplateRecommendation,
} from '../../src/features/visits/shared/components/scribe-recommendations/types';

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

describe('templateFilledCard', () => {
  const template = (sectionActions?: TemplateRecommendation['sectionActions']): TemplateRecommendation => ({
    id: 'template-1',
    kind: 'template',
    section: 'template',
    templateName: 'Sinusitis',
    ...(sectionActions ? { sectionActions } : {}),
  });

  it('badges only the cards whose sections the apply dialog did not skip', () => {
    const applied = template({ examFindings: 'skip', mdm: 'overwrite', patientInstructions: 'skip' });
    expect(templateFilledCard(applied, 'examination')).toBe(false);
    expect(templateFilledCard(applied, 'assessment')).toBe(true);
    expect(templateFilledCard(applied, 'plan')).toBe(false);
  });

  it('badges the assessment while any of its sections was written', () => {
    const allButCodes = template({ mdm: 'skip', diagnoses: 'skip', emCode: 'skip', cptCodes: 'append' });
    expect(templateFilledCard(allButCodes, 'assessment')).toBe(true);
    const none = template({ mdm: 'skip', diagnoses: 'skip', emCode: 'skip', cptCodes: 'skip' });
    expect(templateFilledCard(none, 'assessment')).toBe(false);
  });

  it('treats a section the dialog left unset as applied with its default action', () => {
    expect(templateFilledCard(template({}), 'examination')).toBe(true);
    expect(templateFilledCard(template(), 'plan')).toBe(true);
  });
});
