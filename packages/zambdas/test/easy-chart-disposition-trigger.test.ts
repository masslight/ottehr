import { detectDispositionLanguage } from 'utils/lib/easy-chart/sniffers';
import { describe, expect, it } from 'vitest';

// detectDispositionLanguage is the deterministic trigger for the review's disposition check:
// on a hit (with no disposition charted) the review prompt force-includes a must-address
// instruction for that check. The scan is tuned for HIGH PRECISION — a miss just leaves the
// check on its normal model-discretion path. All narrative snippets below are synthetic.
describe('detectDispositionLanguage', () => {
  describe('positive disposition language', () => {
    it.each([
      ['follow-up', 'Sounds viral. Follow up with your PCP in one week if the cough lingers.'],
      ['follow-up', 'I want you to follow up in 3 to 5 days for a wound check.'],
      ['follow-up', 'Please follow up as needed.'],
      ['follow-up', 'Follow-up with ophthalmology recommended.'],
      ['schedule-follow-up', 'The front desk will schedule a follow up before you leave.'],
      ['recheck', 'Come see me for a recheck in 2 days to look at that eardrum again.'],
      ['recheck', 'We will do a recheck visit after the antibiotics are done.'],
      ['return-to-clinic', 'Return to the clinic in 48 hours if the fever persists.'],
      ['return-to-clinic', 'Come back if the swelling spreads past the line I drew.'],
      ['return-to-clinic', 'Come back in three days so we can look at it again.'],
      ['return-precautions', 'Return precautions were discussed with mom at length.'],
      ['referral', 'I am placing a referral to orthopedics for the ankle.'],
      ['referral', 'We will be referring you to dermatology for that lesion.'],
      ['emergency-care', 'If he starts breathing fast, go straight to the ER.'],
      ['emergency-care', 'Any chest pain tonight, call 911 immediately.'],
      ['emergency-care', 'She should seek emergency care if the vomiting returns.'],
      ['discharge-home', 'Patient was discharged home in stable condition.'],
      ['discharge-home', 'Discharge instructions were reviewed with the family.'],
      ['discharge-home', 'She was sent home with a copy of the care plan.'],
      ['call-office', 'Call us if the rash is not fading by Friday.'],
    ])('matches %s: "%s"', (label, narrative) => {
      const match = detectDispositionLanguage(narrative);
      expect(match?.pattern).toBe(label);
      expect(narrative).toContain(match!.excerpt);
    });

    it('a negated early mention does not mask a later positive one', () => {
      const match = detectDispositionLanguage(
        'No referral needed for the ear. But follow up with your pediatrician in a week for the rash.'
      );
      expect(match?.pattern).toBe('follow-up');
    });

    it('"if no better" is a positive disposition, not a negation', () => {
      // "no" here negates the improvement, not the follow-up.
      expect(detectDispositionLanguage('If no better, come back in 3 days.')?.pattern).toBe('return-to-clinic');
    });

    it('a comma bounds the negation window', () => {
      expect(detectDispositionLanguage('The rash is not improving, come back in 2 days.')?.pattern).toBe(
        'return-to-clinic'
      );
    });

    it('conditional follow-up phrasing is not treated as a trailing negation', () => {
      expect(detectDispositionLanguage('Follow up if not improving by Monday.')?.pattern).toBe('follow-up');
    });

    // DECISION: quoted/reported instructions fire the trigger. The model owns extraction and is
    // explicitly told to decline when the matched text is not a disposition for THIS visit —
    // a decline emits nothing (only the counter records it).
    it('reported speech still fires (model is told to adjudicate it)', () => {
      expect(
        detectDispositionLanguage('Mom says urgent care told them to follow up with their PCP this week.')?.pattern
      ).toBe('follow-up');
    });
  });

  describe('negations and non-disposition look-alikes', () => {
    it.each([
      ['explicit negation', 'Reassured mom. No follow up with a specialist is needed at this time.'],
      ['does-not-need negation', 'He does not need a referral to ENT at this point.'],
      ['trailing negation', 'A follow up with cardiology was not needed given the normal ECG.'],
      ['declined referral', 'Offered a referral to physical therapy but the patient declined.'],
      ['visit-reason follow-up', 'Patient is here for follow-up of his asthma after last month’s visit.'],
      ['symptom recurrence', 'The hives come back whenever she eats strawberries.'],
      ['mid-exam recheck', 'Let me recheck that left ear before we decide anything.'],
      ['HPI worse-at-night', 'She says the pain gets worse if she lies down at night.'],
      ['past referral inbound', 'She was referred to us by her primary care office this morning.'],
      ['prn dosing not a disposition', 'Ibuprofen as needed for pain, every six hours with food.'],
      ['return to school', 'He can return to school tomorrow once he is fever free.'],
      ['no language at all', 'Exam shows a clear chest and normal ears. Strep was negative.'],
    ])('does not fire on %s: "%s"', (_label, narrative) => {
      expect(detectDispositionLanguage(narrative)).toBeUndefined();
    });
  });
});
