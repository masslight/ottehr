// apply-template is a SUGGESTION: the server resolves the model's title to a practice template and the
// provider applies it by hand. These pin the resolution: exact titles first, a little tolerance for the
// model's wording, and no match at all rather than a guess.
import { describe, expect, it } from 'vitest';
import { resolveSuggestedTemplate } from '../src/ehr/easy-chart-plan/helpers';

const templates = [
  { id: 't1', title: 'Acute Otitis Media' },
  { id: 't2', title: 'Sprain/strain with xray' },
  { id: 't3', title: 'Sprain/strain' },
  { id: 't4', title: 'Headache' },
  { id: 't5', title: 'URI (Upper Respiratory Infection)' },
];

describe('resolveSuggestedTemplate', () => {
  it('matches an exact title regardless of case and punctuation', () => {
    expect(resolveSuggestedTemplate(templates, { display: 'acute otitis media' })?.id).toBe('t1');
    expect(resolveSuggestedTemplate(templates, { display: 'Sprain/Strain With X-Ray' })?.id).toBe('t2');
  });

  it('prefers the shortest containing title, so a bare "Sprain/strain" does not pick the x-ray variant', () => {
    expect(resolveSuggestedTemplate(templates, { display: 'Sprain strain' })?.id).toBe('t3');
    expect(resolveSuggestedTemplate(templates, { display: 'URI' })?.id).toBe('t5');
  });

  it('falls back to shared words with the searchTerms, at least half the title', () => {
    expect(resolveSuggestedTemplate(templates, { display: 'Otitis media, acute', searchTerms: ['AOM'] })?.id).toBe(
      't1'
    );
  });

  it('returns nothing for a title the practice does not have — a rejection, never a guess', () => {
    expect(resolveSuggestedTemplate(templates, { display: 'Migraine' })).toBeUndefined();
    expect(resolveSuggestedTemplate(templates, { display: '' })).toBeUndefined();
    expect(resolveSuggestedTemplate([], { display: 'Headache' })).toBeUndefined();
  });
});
