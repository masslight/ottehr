import { recoverSourceText } from 'utils/lib/easy-chart/sniffers';
import { describe, expect, it } from 'vitest';

// recoverSourceText backfills a step's missing provenance quote from the narrative so the hover
// can cite the dictation instead of downgrading to "inferred".
describe('recoverSourceText', () => {
  const narrative =
    'On local inspection of the left eye, there is a tender pustular nodule on the eyelid margin. ' +
    "For the plan, let's prescribe Erythromycin 0.5 percent ophthalmic ointment, to be applied to the " +
    'left upper eyelid four times daily for 7 days. Follow up with ophthalmology in 3 to 4 days.';

  it('finds the prescribing sentence for a medication step', () => {
    const src = recoverSourceText(narrative, ['Erythromycin 0.5% ophthalmic ointment', 'Erythromycin']);
    expect(src).toContain('prescribe Erythromycin 0.5 percent ophthalmic ointment');
  });

  it('returns undefined when nothing plausibly matches (stays honestly "inferred")', () => {
    expect(recoverSourceText(narrative, ['Amoxicillin suspension'])).toBeUndefined();
  });

  it('ignores empty/short needles', () => {
    expect(recoverSourceText(narrative, [undefined, '', 'a b'])).toBeUndefined();
  });
});
