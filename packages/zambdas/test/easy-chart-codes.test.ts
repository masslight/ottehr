import { describe, expect, it } from 'vitest';
import { resolveIcd } from '../src/shared/easy-chart/codes';

// resolveIcd is the "no hallucinated code reaches the note" invariant. These cases lock in the
// laterality sanity check: a hinted code that is REAL but contradicts the intent's own left/right
// or upper/lower wording must be replaced by the display-consistent code, not trusted.
describe('resolveIcd', () => {
  it('rejects a wrong-laterality hint and resolves from the display instead', async () => {
    // The model once hinted H00.012 (hordeolum externum RIGHT LOWER eyelid) for a dictated
    // LEFT UPPER stye — a real code, wrong anatomy.
    const resolved = await resolveIcd('H00.012', 'Hordeolum, left upper eyelid', ['hordeolum']);
    expect(resolved).toBeDefined();
    expect(resolved!.display.toLowerCase()).toContain('left upper');
    expect(resolved!.code).toBe('H00.014');
  });

  it('keeps a consistent hint as-is', async () => {
    const resolved = await resolveIcd('H00.014', 'Hordeolum, left upper eyelid', []);
    expect(resolved!.code).toBe('H00.014');
  });

  it('keeps a hint when the intent text carries no qualifiers to contradict', async () => {
    const resolved = await resolveIcd('J45.901', 'Acute asthma exacerbation', []);
    expect(resolved!.code).toBe('J45.901');
  });

  it('rejects a real-but-wrong hint whose display shares no words with the intent', async () => {
    // S09.90XA is "Unspecified injury of head" — a real code the model once hinted for a
    // dictated concussion; the display-based search must take over.
    const resolved = await resolveIcd('S09.90XA', 'Concussion without loss of consciousness', ['concussion']);
    expect(resolved).toBeDefined();
    expect(resolved!.display.toLowerCase()).toContain('concussion');
  });
});
