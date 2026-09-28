import { unsupportedEtiologyQualifiers } from 'utils/lib/easy-chart/codes';
import {
  contradictsHistoryContext,
  contradictsInjuryRegion,
  contradictsQualifiers,
} from 'utils/lib/easy-chart/icd-contradictions';
import { repairUnsupportedEtiology, resolveIcd, upgradeCodeSpecificity } from 'utils/lib/easy-chart/icd-resolve';
import { describe, expect, it } from 'vitest';
import { fakeIcdSearch, PLATFORM_DISPLAY_FIXTURES } from './helpers/fake-icd-search';

const search = fakeIcdSearch(PLATFORM_DISPLAY_FIXTURES);

// A hinted code is kept only when it is real and consistent with the intent's own wording.
describe('resolveIcd', () => {
  it('rejects a wrong-laterality hint and resolves from the display instead', async () => {
    // H00.012 is a real code, but for the right lower eyelid.
    const resolved = await resolveIcd(search, 'H00.012', 'Hordeolum, left upper eyelid', ['hordeolum']);
    expect(resolved).toBeDefined();
    expect(resolved!.display.toLowerCase()).toContain('left upper');
    expect(resolved!.code).toBe('H00.014');
  });

  it('keeps a consistent hint as-is', async () => {
    const resolved = await resolveIcd(search, 'H00.014', 'Hordeolum, left upper eyelid', []);
    expect(resolved!.code).toBe('H00.014');
  });

  it('keeps a hint when the intent text carries no qualifiers to contradict', async () => {
    const resolved = await resolveIcd(search, 'J45.901', 'Acute asthma exacerbation', []);
    expect(resolved!.code).toBe('J45.901');
  });

  it('rejects a real-but-wrong hint whose display shares no words with the intent', async () => {
    // S09.90XA is "Unspecified injury of head".
    const resolved = await resolveIcd(search, 'S09.90XA', 'Concussion without loss of consciousness', ['concussion']);
    expect(resolved).toBeDefined();
    expect(resolved!.display.toLowerCase()).toContain('concussion');
  });

  it('rejects a head-block injury code hinted for a trunk-site display and resolves the trunk code', async () => {
    // S00.439A (ear contusion) also ranks first in the display search, so the fallback must skip it too.
    const resolved = await resolveIcd(search, 'S00.439A', 'Contusion of coccyx', [
      'contusion coccyx',
      'tailbone bruise',
    ]);
    expect(resolved).toBeDefined();
    expect(resolved!.code).toBe('S30.0XXA');
    expect(resolved!.code.startsWith('S00.4')).toBe(false);
  });

  it('resolves a trunk-site display with no hint to the trunk-block code', async () => {
    const resolved = await resolveIcd(search, undefined, 'Tailbone contusion', ['tailbone bruise']);
    expect(resolved!.code).toBe('S30.0XXA');
  });

  it('rejects a wrong-block hint even when its display overlaps the intent wording', async () => {
    // S20.219A (back wall of thorax) passes the word-overlap check; only the S-block region guard rejects it.
    const resolved = await resolveIcd(search, 'S20.219A', 'Contusion of lower back and pelvis', []);
    expect(resolved!.code).toBe('S30.0XXA');
  });

  it('keeps a correct-region injury hint as-is', async () => {
    const resolved = await resolveIcd(search, 'S70.11XA', 'Contusion of right thigh', []);
    expect(resolved!.code).toBe('S70.11XA');
  });
});

// These codes share the S6 block and enough words to pass the overlap check, so only the digit and
// wound-type qualifier groups catch a mismatched pair.
describe('resolveIcd pair consistency (digit / wound-type qualifiers)', () => {
  it('rejects a thumb code hinted for an index-finger display and resolves the index-finger code', async () => {
    const resolved = await resolveIcd(search, 'S61.011A', 'Laceration without foreign body of right index finger', [
      'laceration right index finger',
      'finger laceration',
    ]);
    expect(resolved).toBeDefined();
    expect(resolved!.code).toBe('S61.210A');
    expect(resolved!.display).toBe(
      'Laceration without foreign body of right index finger without damage to nail, initial encounter'
    );
  });

  it('rejects a puncture-wound code hinted for a laceration display', async () => {
    const resolved = await resolveIcd(search, 'S61.230A', 'Laceration of right index finger without damage to nail', [
      'finger laceration',
    ]);
    expect(resolved!.code).toBe('S61.210A');
  });

  it('rejects a right-side code hinted for a left-side display', async () => {
    const resolved = await resolveIcd(search, 'S61.210A', 'Laceration of left index finger', []);
    expect(resolved!.code).toBe('S61.211A');
    expect(resolved!.display.toLowerCase()).toContain('left index finger');
  });

  it('keeps a consistent digit hint as-is, display taken from the code row', async () => {
    const resolved = await resolveIcd(search, 'S61.210A', 'Laceration without foreign body of right index finger', []);
    expect(resolved!.code).toBe('S61.210A');
    expect(resolved!.display).toBe(
      'Laceration without foreign body of right index finger without damage to nail, initial encounter'
    );
  });

  it('resolves nothing when every candidate contradicts the display qualifiers', async () => {
    // The display search returns only the thumb row. No code is better than a contradictory pair,
    // since the client picker can still resolve by display.
    const resolved = await resolveIcd(search, 'S61.011A', 'Laceration of right pointer finger', []);
    expect(resolved).toBeUndefined();
  });
});

describe('contradictsQualifiers digit / wound-type groups', () => {
  it('flags cross-digit and cross-wound-type displays', () => {
    expect(
      contradictsQualifiers(
        'Laceration without foreign body of right index finger',
        'Laceration without foreign body of right thumb without damage to nail, initial encounter'
      )
    ).toBe(true);
    expect(
      contradictsQualifiers(
        'Laceration of right index finger without damage to nail',
        'Puncture wound without foreign body of right index finger without damage to nail, initial encounter'
      )
    ).toBe(true);
  });

  it('passes matching digits and imposes no constraint when only one side names a member', () => {
    expect(
      contradictsQualifiers(
        'Laceration of right index finger',
        'Laceration without foreign body of right index finger without damage to nail, initial encounter'
      )
    ).toBe(false);
    // Intent names no digit ("finger" alone is not a group member) → thumb code unconstrained.
    expect(contradictsQualifiers('Finger laceration', 'Laceration without foreign body of right thumb')).toBe(false);
    // Code display names no wound type → unconstrained.
    expect(contradictsQualifiers('Laceration of finger', 'Unspecified open wound of right index finger')).toBe(false);
  });

  it('never contradicts when a text names several members of the group', () => {
    expect(
      contradictsQualifiers('Laceration of thumb and index finger', 'Laceration without foreign body of right thumb')
    ).toBe(false);
    // "Dog bite laceration" names both wound-type members, so an open-bite code stays eligible.
    expect(
      contradictsQualifiers('Dog bite laceration of hand', 'Open bite of right index finger, initial encounter')
    ).toBe(false);
  });
});

// The S-block partition (head S0x through ankle/foot S9x) versus the intent's own site words.
describe('contradictsInjuryRegion', () => {
  it('flags a head-block code for a trunk-site intent', () => {
    expect(contradictsInjuryRegion('Contusion of coccyx', 'S00.439A')).toBe(true);
    expect(contradictsInjuryRegion('Tailbone bruise', 'S00.439A')).toBe(true);
  });

  it('passes a matching-block code', () => {
    expect(contradictsInjuryRegion('Contusion of coccyx', 'S30.0XXA')).toBe(false);
    expect(contradictsInjuryRegion('Contusion of right thigh', 'S70.11XA')).toBe(false);
  });

  it('imposes no constraint without site words or on non-injury codes', () => {
    expect(contradictsInjuryRegion('Concussion without loss of consciousness', 'S06.0X0A')).toBe(false);
    expect(contradictsInjuryRegion('Hordeolum, left upper eyelid', 'H00.014')).toBe(false);
  });

  it('passes when the intent names multiple regions and one matches the block', () => {
    expect(contradictsInjuryRegion('Fracture of neck of femur', 'S72.001A')).toBe(false);
  });
});

// History and status Z-codes attach only on explicit history/status phrasing; a narrative
// "history of X" for the presenting problem does not qualify.
describe('contradictsHistoryContext', () => {
  it('gates a personal-history code when the intent lacks explicit history phrasing', () => {
    const display = 'Personal history of pneumonia (recurrent)';
    expect(contradictsHistoryContext('History of recurrent ingrown hairs', 'Z87.01', display)).toBe(true);
    expect(contradictsHistoryContext('Ingrown hair, nasal vestibule', 'Z87.01', display)).toBe(true);
  });

  it('passes with explicit personal/family/status-post phrasing', () => {
    expect(
      contradictsHistoryContext('Personal history of pneumonia', 'Z87.01', 'Personal history of pneumonia (recurrent)')
    ).toBe(false);
    expect(
      contradictsHistoryContext('Family history of heart disease', 'Z82.49', 'Family history of ischemic heart disease')
    ).toBe(false);
    expect(
      contradictsHistoryContext('Status post appendectomy', 'Z98.890', 'Other specified postprocedural states')
    ).toBe(false);
  });

  it('imposes no constraint on active-problem codes', () => {
    expect(
      contradictsHistoryContext('History of recurrent ingrown hairs', 'L73.9', 'Follicular disorder, unspecified')
    ).toBe(false);
    expect(contradictsHistoryContext('Recurrent sinusitis', 'J32.9', 'Chronic sinusitis, unspecified')).toBe(false);
  });
});

// Z87.01 shares only "history" and "recurrent" with the ingrown-hair intent.
describe('resolveIcd history/status gate', () => {
  it('regression: a narrative "history of recurrent X" intent never charts a Z8x history code', async () => {
    const resolved = await resolveIcd(search, undefined, 'History of recurrent ingrown hairs', [
      'recurrent ingrown hair nasal vestibule',
    ]);
    expect(resolved?.code.startsWith('Z8')).not.toBe(true);
  });

  it('rejects the Z87.01 hint itself for the same intent', async () => {
    const resolved = await resolveIcd(search, 'Z87.01', 'History of recurrent ingrown hairs', [
      'recurrent ingrown hair',
    ]);
    expect(resolved?.code).not.toBe('Z87.01');
  });

  it('keeps Z87.01 for an explicit personal-history intent', async () => {
    const resolved = await resolveIcd(search, 'Z87.01', 'Personal history of pneumonia', []);
    expect(resolved!.code).toBe('Z87.01');
  });
});

// Upgrade only when the intent names laterality or recurrence the code lacks and exactly one
// same-category sibling encodes it; otherwise keep the validated code.
describe('specificity upgrade (laterality / recurrence)', () => {
  it('upgrades an unspecified-side hint when a search term names the side', async () => {
    const resolved = await resolveIcd(search, 'H66.90', 'Otitis media', ['left ear infection']);
    expect(resolved!.code).toBe('H66.92');
    expect(resolved!.display.toLowerCase()).toContain('left ear');
  });

  it('upgrades a search-resolved code from laterality named only in sourceText', async () => {
    const resolved = await resolveIcd(
      search,
      undefined,
      'Otitis media',
      ['ear infection'],
      'his left ear has been hurting'
    );
    expect(resolved!.code).toBe('H66.92');
  });

  it('upgrades to the recurrent sibling when the narrative says "frequent"', async () => {
    const resolved = await resolveIcd(search, 'J03.90', 'Acute tonsillitis', ['frequent sore throats']);
    expect(resolved!.code).toBe('J03.91');
    expect(resolved!.display.toLowerCase()).toContain('recurrent');
  });

  it('chains laterality then recurrence when the narrative names both', async () => {
    const upgraded = await upgradeCodeSpecificity(
      search,
      {
        code: 'H66.009',
        display: 'Acute suppurative otitis media without spontaneous rupture of ear drum, unspecified ear',
      },
      ['recurrent left ear infections']
    );
    expect(upgraded.code).toBe('H66.005');
  });

  it('keeps the code when the intent names conflicting sides', async () => {
    const resolved = await resolveIcd(search, 'H66.90', 'Otitis media', ['left ear', 'right ear pain']);
    expect(resolved!.code).toBe('H66.90');
  });

  it('keeps the code when several same-category siblings encode the attribute', async () => {
    // H61.1x has two "left ear" pinna siblings that differ from this display only by neutralized words.
    const upgraded = await upgradeCodeSpecificity(
      search,
      { code: 'H61.199', display: 'Noninfective disorders of pinna, unspecified ear' },
      ['left ear']
    );
    expect(upgraded.code).toBe('H61.199');
  });

  it('never leaves the 3-character category: no sibling means no change', async () => {
    const resolved = await resolveIcd(search, 'J02.9', 'Acute pharyngitis', ['left side sore throat']);
    expect(resolved!.code).toBe('J02.9');
  });

  it('never downgrades or sidegrades an already-specific code', async () => {
    const resolved = await resolveIcd(search, 'H66.92', 'Otitis media, left ear', ['left ear infection']);
    expect(resolved!.code).toBe('H66.92');
  });

  it('upgrades injury-code laterality while preserving the encounter phase', async () => {
    const resolved = await resolveIcd(search, 'S93.409A', 'Ankle sprain', ['left ankle sprain']);
    expect(resolved!.code).toBe('S93.402A');
    expect(resolved!.display.toLowerCase()).toContain('initial encounter');
  });

  it('treats digits as distinguishing, so numeric siblings resolve uniquely', async () => {
    // Six H35.1x "left eye" stage variants exist; only the same-stage one may match.
    const upgraded = await upgradeCodeSpecificity(
      search,
      { code: 'H35.119', display: 'Retinopathy of prematurity, stage 0, unspecified eye' },
      ['left eye']
    );
    expect(upgraded.code).toBe('H35.112');
  });
});

// The etiology guard flags display qualifiers the evidence never supports, then repairs or refuses the code.
// The evidence below documents yeast and purulent AOM, contradicting gonococcal and serous displays.
const YEAST_EVIDENCE =
  'Vaginal itching with thick white discharge; wet mount shows budding yeast, consistent with candidal vulvovaginitis.';
const PURULENT_AOM_EVIDENCE =
  'Bulging erythematous tympanic membranes bilaterally with purulent material behind both; frequent ear infections per mom.';

describe('unsupportedEtiologyQualifiers', () => {
  it('flags gonococcal when the evidence documents yeast', () => {
    expect(unsupportedEtiologyQualifiers('Gonococcal vulvovaginitis, unspecified', YEAST_EVIDENCE)).toEqual([
      'gonococcal',
    ]);
  });

  it('passes a candidiasis display for the same yeast evidence', () => {
    expect(unsupportedEtiologyQualifiers('Candidiasis of vulva and vagina', YEAST_EVIDENCE)).toEqual([]);
  });

  it('flags serous (but not suppurative or recurrent) for a purulent recurrent-AOM narrative', () => {
    expect(
      unsupportedEtiologyQualifiers('Acute serous otitis media, recurrent, bilateral', PURULENT_AOM_EVIDENCE)
    ).toEqual(['serous']);
    expect(
      unsupportedEtiologyQualifiers(
        'Acute suppurative otitis media without spontaneous rupture of ear drum, recurrent, bilateral',
        PURULENT_AOM_EVIDENCE
      )
    ).toEqual([]);
  });

  it('imposes no constraint on displays without vocabulary qualifiers', () => {
    expect(unsupportedEtiologyQualifiers('Acute pharyngitis, unspecified', 'sore throat for two days')).toEqual([]);
  });

  it('credits short stems only as standalone evidence tokens', () => {
    // 'gc' must match the token "gc", never a substring inside another word ("gcs").
    expect(unsupportedEtiologyQualifiers('Gonococcal vulvovaginitis, unspecified', 'gc probe positive')).toEqual([]);
    expect(unsupportedEtiologyQualifiers('Gonococcal vulvovaginitis, unspecified', 'gcs 15 on arrival')).toEqual([
      'gonococcal',
    ]);
  });
});

describe('repairUnsupportedEtiology', () => {
  it('repairs the gonococcal live case to candidal vulvovaginitis (B37.3)', async () => {
    const repaired = await repairUnsupportedEtiology(
      search,
      { code: 'A54.02', display: 'Gonococcal vulvovaginitis, unspecified' },
      YEAST_EVIDENCE
    );
    expect(repaired?.code).toBe('B37.31');
  });

  it('repairs the serous live case into the suppurative H66.0x family, keeping recurrence and laterality', async () => {
    const repaired = await repairUnsupportedEtiology(
      search,
      { code: 'H65.06', display: 'Acute serous otitis media, recurrent, bilateral' },
      PURULENT_AOM_EVIDENCE
    );
    expect(repaired?.code).toBe('H66.006');
  });

  it('returns undefined when no clean same-condition replacement exists', async () => {
    // Every code matching gingivostomatitis+pharyngotonsillitis is the herpesviral one itself.
    const repaired = await repairUnsupportedEtiology(
      search,
      { code: 'B00.2', display: 'Herpesviral gingivostomatitis and pharyngotonsillitis' },
      'Twisted ankle at soccer practice with pain on weight bearing.'
    );
    expect(repaired).toBeUndefined();
  });
});
