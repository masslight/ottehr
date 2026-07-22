import { describe, expect, it } from 'vitest';
import { validateActionCodes } from '../src/ehr/easy-chart-review/index';
import { fakeIcdSearch, PLATFORM_DISPLAY_FIXTURES } from './helpers/fake-icd-search';

// ICD resolution runs against the deterministic terminology stand-in (fixture corpus +
// probe-mirroring display responses) injected through validateActionCodes' test seam.
const search = fakeIcdSearch(PLATFORM_DISPLAY_FIXTURES);

// Review-side etiology-support guard: a suggested add-diagnosis whose ICD display carries an
// organism/etiology/type qualifier the evidence never supports is deterministically repaired
// (code+display substituted) or the WHOLE suggestion is dropped — never reduced to a bare
// removal (that would recreate the zero-diagnoses bug the swap mandate fixed). Both live cases
// are pinned with synthetic narratives; validateActionCodes is exported for these tests the same
// way buildPrompt is.
describe('easy-chart-review etiology guard', () => {
  it('live case: repairs a gonococcal add inside a coherence swap to candidal (B37.x) for a yeast narrative', async () => {
    const actions: Record<string, unknown>[] = [
      { kind: 'remove-diagnosis', display: 'Acute vaginitis (N76.0)', isPrimary: false },
      {
        kind: 'add-diagnosis',
        display: 'Gonococcal vulvovaginitis',
        searchTerms: ['vulvovaginitis'],
        code: 'A54.02',
        isPrimary: true,
      },
    ];
    const evidence =
      'Vaginal itching and thick white discharge; wet mount shows budding yeast, consistent with candidal vulvovaginitis. Chart: Acute vaginitis (N76.0) (primary)';
    const result = await validateActionCodes(actions, undefined, evidence, search);
    expect(result).toEqual({ keep: true, etiologyRepaired: 1, etiologyDropped: false });
    expect(actions[1].code).toBe('B37.31');
    expect(actions[1].display).toBe('Acute candidiasis of vulva and vagina');
    expect(actions[1].isPrimary).toBe(true);
    // The remove half of the swap is untouched.
    expect(actions[0]).toEqual({ kind: 'remove-diagnosis', display: 'Acute vaginitis (N76.0)', isPrimary: false });
  });

  it('live case: repairs a serous otitis add to the suppurative H66.0x family for a purulent-AOM narrative', async () => {
    const actions: Record<string, unknown>[] = [
      { kind: 'remove-diagnosis', display: 'Acute suppurative otitis media, bilateral (H66.003)', isPrimary: false },
      {
        kind: 'add-diagnosis',
        display: 'Acute serous otitis media, recurrent, bilateral',
        searchTerms: ['recurrent bilateral otitis media'],
        code: 'H65.06',
        isPrimary: true,
      },
    ];
    const evidence =
      'Bulging erythematous tympanic membranes bilaterally with purulent material behind both; frequent ear infections per mom.';
    const result = await validateActionCodes(actions, undefined, evidence, search);
    expect(result.keep).toBe(true);
    expect(result.etiologyRepaired).toBe(1);
    expect(actions[1].code).toBe('H66.006');
  });

  it('drops the whole suggestion (remove included) when the add has no clean replacement', async () => {
    const actions: Record<string, unknown>[] = [
      { kind: 'remove-diagnosis', display: 'Acute pharyngitis (J02.9)', isPrimary: false },
      {
        kind: 'add-diagnosis',
        display: 'Herpesviral gingivostomatitis',
        code: 'B00.2',
        isPrimary: true,
      },
    ];
    const result = await validateActionCodes(
      actions,
      undefined,
      'Twisted ankle at soccer practice, pain and swelling.',
      search
    );
    expect(result).toEqual({ keep: false, etiologyRepaired: 0, etiologyDropped: true });
  });

  it('runs no repair on a supported-qualifier add (normal resolution still applies)', async () => {
    const actions: Record<string, unknown>[] = [
      { kind: 'add-diagnosis', display: 'Candidal vulvovaginitis', code: 'B37.3', isPrimary: false },
    ];
    const result = await validateActionCodes(
      actions,
      undefined,
      'Wet mount shows budding yeast; treated for a yeast infection.',
      search
    );
    expect(result).toEqual({ keep: true, etiologyRepaired: 0, etiologyDropped: false });
    expect(actions[0].code).toBe('B37.31');
  });

  it('passes a no-qualifier add untouched', async () => {
    const actions: Record<string, unknown>[] = [
      { kind: 'add-diagnosis', display: 'Acute pharyngitis', code: 'J02.9', isPrimary: false },
    ];
    const result = await validateActionCodes(actions, undefined, 'Sore throat for two days, no fever.', search);
    expect(result).toEqual({ keep: true, etiologyRepaired: 0, etiologyDropped: false });
    expect(actions[0].code).toBe('J02.9');
  });

  it('a qualifier supported only by the suggestion rationale counts as evidence', async () => {
    // Check-2 recurrence cards justify "recurrent" in the rationale; the handler appends it to
    // the evidence haystack, so the guard must credit it.
    const actions: Record<string, unknown>[] = [
      {
        kind: 'add-diagnosis',
        display: 'Acute suppurative otitis media without spontaneous rupture of ear drum, recurrent, bilateral',
        code: 'H66.006',
        isPrimary: true,
      },
    ];
    const narrative = 'Both ears hurt again, pus behind both drums.';
    const rationale = 'Narrative indicates recurrent bilateral infections.';
    const result = await validateActionCodes(actions, undefined, `${narrative} ${rationale}`, search);
    expect(result).toEqual({ keep: true, etiologyRepaired: 0, etiologyDropped: false });
    expect(actions[0].code).toBe('H66.006');
  });
});
