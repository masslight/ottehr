import { describe, expect, it } from 'vitest';
import {
  findingPolarity,
  quoteOccursInNarrative,
  rosPolarity,
  verifiedSourceText,
} from './provenance';

const NARRATIVE =
  'Seven-year-old male here with two days of sore throat and fever to 102. No cough, no runny nose. ' +
  'On exam tonsils are enlarged and erythematous with white exudate, lungs clear bilaterally.';

describe('quote verification', () => {
  it('accepts a genuine verbatim quote, ignoring case and punctuation noise', () => {
    expect(quoteOccursInNarrative('tonsils are enlarged and erythematous', NARRATIVE)).toBe(true);
    expect(quoteOccursInNarrative('Tonsils are enlarged, and erythematous', NARRATIVE)).toBe(true);
  });

  // Models paraphrase and stitch list items together with ellipses. A fabricated citation in a
  // medical record is worse than none.
  it('rejects a paraphrase and a stitched-together quote', () => {
    expect(quoteOccursInNarrative('the tonsils looked swollen and red', NARRATIVE)).toBe(false);
    expect(quoteOccursInNarrative('sore throat … white exudate', NARRATIVE)).toBe(false);
  });

  it('treats an absent quote as an honest "inferred", not a failure', () => {
    expect(quoteOccursInNarrative('', NARRATIVE)).toBe(true);
    expect(verifiedSourceText('', NARRATIVE)).toBeUndefined();
    expect(verifiedSourceText(undefined, NARRATIVE)).toBeUndefined();
  });

  it('drops a fabricated quote so the item is marked inferred rather than falsely cited', () => {
    expect(verifiedSourceText('patient reports severe dysphagia', NARRATIVE)).toBeUndefined();
    expect(verifiedSourceText('white exudate', NARRATIVE)).toBe('white exudate');
  });
});

describe('findingPolarity', () => {
  // "No wheezing" must neither create a wheezing finding nor remove the matching normal — it AGREES
  // with the normal. Match on polarity, not on the keyword.
  it('reads a negated finding as negated', () => {
    expect(findingPolarity('no wheezing')).toBe('negated');
    expect(findingPolarity('without crackles')).toBe('negated');
    expect(findingPolarity('non-tender')).toBe('negated');
    expect(findingPolarity('denies fever')).toBe('negated');
    expect(findingPolarity('straight leg raise negative bilaterally')).toBe('negated');
  });

  it('reads an asserted normal as normal, not as an abnormality', () => {
    expect(findingPolarity('lungs clear bilaterally')).toBe('normal');
    expect(findingPolarity('neuro exam is normal')).toBe('normal');
    expect(findingPolarity('sensation intact')).toBe('normal');
  });

  it('reads a genuine abnormality as positive', () => {
    expect(findingPolarity('Right TM erythematous and bulging')).toBe('positive');
    expect(findingPolarity('tonsillar exudate present')).toBe('positive');
    expect(findingPolarity('scattered wheezes bilaterally')).toBe('positive');
  });
});

describe('rosPolarity', () => {
  // ROS carries polarity in the display text; the structured `finding` enum is a secondary signal.
  it('takes the polarity from the display text first', () => {
    expect(rosPolarity('Denies chest pain')).toBe('denies');
    expect(rosPolarity('Reports headache')).toBe('reports');
    expect(rosPolarity('Denies chest pain', 'reports')).toBe('denies');
  });

  it('falls back to the enum only when the text carries no verb', () => {
    expect(rosPolarity('chest pain', 'denies')).toBe('denies');
    expect(rosPolarity('chest pain')).toBeUndefined();
  });
});
