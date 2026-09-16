import { describe, expect, it } from 'vitest';
import { findingPolarity, locateQuote, quoteOccursInNarrative, rosPolarity, verifiedSourceText } from './provenance';

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

describe('locateQuote', () => {
  const narrative =
    'Provider: Any fever?\nPatient: “No fever.”  I checked, a couple of times.\nPatient: I’m about 170 pounds.';
  const slice = (quote: string): string | undefined => {
    const at = locateQuote(narrative, quote);
    return at && narrative.slice(at.start, at.end);
  };

  it('returns offsets into the original text', () => {
    expect(slice('No fever.')).toBe('No fever.');
    expect(slice("I'm about 170 pounds")).toBe('I’m about 170 pounds');
  });

  it('ignores case, punctuation and whitespace, exactly as verification does', () => {
    expect(slice('no fever')).toBe('No fever');
    expect(slice('i checked a couple of times')).toBe('I checked, a couple of times');
    // Wording is not noise: a quote that is not really there is not found.
    expect(locateQuote(narrative, 'no fevers')).toBeUndefined();
    expect(locateQuote(narrative, '')).toBeUndefined();
  });

  it('agrees with quoteOccursInNarrative on every quote', () => {
    for (const quote of [
      'No fever.',
      'a couple of times',
      'checked a couple',
      'no fevers',
      'about 170 pounds!',
      'Patient: I’m',
    ]) {
      expect(locateQuote(narrative, quote) !== undefined, quote).toBe(quoteOccursInNarrative(quote, narrative));
    }
  });

  it('finds a quote that crosses a line break', () => {
    expect(slice('times. Patient: I’m')).toBe('times.\nPatient: I’m');
  });
});

describe('quote clamp', () => {
  // Asked for "a few words to one sentence", the model sometimes quotes a whole paragraph. A paragraph
  // highlighted in the narrative and repeated in a tooltip points at nothing, so an over-long quote is
  // cut down — and re-verified, because a cut is a new quote.
  const sentence = (n: number): string => `Sentence number ${n} of the dictation says something more about the visit.`;
  const long = [1, 2, 3, 4, 5].map(sentence).join(' ');
  const narrative = `Preamble. ${long} Closing remark.`;

  it('cuts an over-long quote at the first sentence end after the limit', () => {
    const clamped = verifiedSourceText(long, narrative);
    expect(clamped).toBeDefined();
    expect(clamped!.length).toBeLessThan(long.length);
    expect(clamped!.length).toBeGreaterThan(200);
    expect(clamped!.endsWith('.')).toBe(true);
    // Whole sentences only: the cut lands on the end of the sentence that crosses the 200th character.
    expect(clamped).toBe([1, 2, 3].map(sentence).join(' '));
    expect(quoteOccursInNarrative(clamped, narrative)).toBe(true);
  });

  it('cuts at a word boundary at the limit when no sentence ends after it', () => {
    const words = Array.from({ length: 60 }, (_, i) => `word${i}`).join(' ');
    const clamped = verifiedSourceText(words, `Intro. ${words} Outro.`);
    expect(clamped).toBeDefined();
    expect(clamped!.length).toBeLessThanOrEqual(200);
    expect(clamped!.endsWith('word')).toBe(false);
    expect(words.startsWith(clamped!)).toBe(true);
    // Whole words only.
    expect(words.charAt(clamped!.length)).toBe(' ');
  });

  it('leaves a quote within the limit alone, and still drops one the narrative lacks', () => {
    expect(verifiedSourceText(sentence(1), narrative)).toBe(sentence(1));
    expect(verifiedSourceText(`${long} Not in the narrative.`, narrative)).toBeUndefined();
  });
});
