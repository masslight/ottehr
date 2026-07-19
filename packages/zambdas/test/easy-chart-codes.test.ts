import { describe, expect, it } from 'vitest';
import { contradictsInjuryRegion, resolveIcd, upgradeCodeSpecificity } from '../src/shared/easy-chart/codes';

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

  it('rejects a head-block injury code hinted for a trunk-site display and resolves the trunk code', async () => {
    // The model once hinted the EAR contusion code (S00.4x, head block) for a dictated tailbone
    // contusion. The hint must be rejected AND the fallback search must not re-attach it (it
    // ranked first among "contusion" ties); the lower-back/pelvis block code is the answer.
    const resolved = await resolveIcd('S00.439A', 'Contusion of coccyx', ['contusion coccyx', 'tailbone bruise']);
    expect(resolved).toBeDefined();
    expect(resolved!.code).toBe('S30.0XXA');
    expect(resolved!.code.startsWith('S00.4')).toBe(false);
  });

  it('resolves a trunk-site display with no hint to the trunk-block code', async () => {
    const resolved = await resolveIcd(undefined, 'Tailbone contusion', ['tailbone bruise']);
    expect(resolved!.code).toBe('S30.0XXA');
  });

  it('rejects a wrong-block hint even when its display overlaps the intent wording', async () => {
    // S20.219A "Contusion of back wall of thorax" shares "contusion"+"back" with the intent, so
    // the word-overlap check alone passes — only the S-block region guard catches that thorax
    // (S2x) is the wrong block for a lower back/pelvis (S3x) site.
    const resolved = await resolveIcd('S20.219A', 'Contusion of lower back and pelvis', []);
    expect(resolved!.code).toBe('S30.0XXA');
  });

  it('keeps a correct-region injury hint as-is', async () => {
    const resolved = await resolveIcd('S70.11XA', 'Contusion of right thigh', []);
    expect(resolved!.code).toBe('S70.11XA');
  });
});

// Direct guard coverage: the S-block partition (head S0x … ankle/foot S9x) versus the intent's
// own site words. Non-injury codes and site-less intents impose no constraint.
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

// Specificity upgrade: when the intent's own text names laterality or recurrence that the
// validated code doesn't encode, and exactly ONE same-category sibling does, upgrade to it.
// Ambiguity or a missing exact sibling always keeps the validated code.
describe('specificity upgrade (laterality / recurrence)', () => {
  it('upgrades an unspecified-side hint when a search term names the side', async () => {
    const resolved = await resolveIcd('H66.90', 'Otitis media', ['left ear infection']);
    expect(resolved!.code).toBe('H66.92');
    expect(resolved!.display.toLowerCase()).toContain('left ear');
  });

  it('upgrades a search-resolved code from laterality named only in sourceText', async () => {
    const resolved = await resolveIcd(undefined, 'Otitis media', ['ear infection'], 'his left ear has been hurting');
    expect(resolved!.code).toBe('H66.92');
  });

  it('upgrades to the recurrent sibling when the narrative says "frequent"', async () => {
    const resolved = await resolveIcd('J03.90', 'Acute tonsillitis', ['frequent sore throats']);
    expect(resolved!.code).toBe('J03.91');
    expect(resolved!.display.toLowerCase()).toContain('recurrent');
  });

  it('chains laterality then recurrence when the narrative names both', async () => {
    const upgraded = await upgradeCodeSpecificity(
      {
        code: 'H66.009',
        display: 'Acute suppurative otitis media without spontaneous rupture of ear drum, unspecified ear',
      },
      ['recurrent left ear infections']
    );
    expect(upgraded.code).toBe('H66.005');
  });

  it('keeps the code when the intent names conflicting sides', async () => {
    const resolved = await resolveIcd('H66.90', 'Otitis media', ['left ear', 'right ear pain']);
    expect(resolved!.code).toBe('H66.90');
  });

  it('keeps the code when several same-category siblings encode the attribute', async () => {
    // H61.1x has two "left ear" pinna-disorder siblings that differ from this display only by
    // neutralized words — ambiguous, so no upgrade.
    const upgraded = await upgradeCodeSpecificity(
      { code: 'H61.199', display: 'Noninfective disorders of pinna, unspecified ear' },
      ['left ear']
    );
    expect(upgraded.code).toBe('H61.199');
  });

  it('never leaves the 3-character category: no sibling means no change', async () => {
    const resolved = await resolveIcd('J02.9', 'Acute pharyngitis', ['left side sore throat']);
    expect(resolved!.code).toBe('J02.9');
  });

  it('never downgrades or sidegrades an already-specific code', async () => {
    const resolved = await resolveIcd('H66.92', 'Otitis media, left ear', ['left ear infection']);
    expect(resolved!.code).toBe('H66.92');
  });

  it('upgrades injury-code laterality while preserving the encounter phase', async () => {
    const resolved = await resolveIcd('S93.409A', 'Ankle sprain', ['left ankle sprain']);
    expect(resolved!.code).toBe('S93.402A');
    expect(resolved!.display.toLowerCase()).toContain('initial encounter');
  });

  it('treats digits as distinguishing, so numeric siblings resolve uniquely', async () => {
    // Six H35.1x "left eye" stage variants exist; only the same-stage one may match.
    const upgraded = await upgradeCodeSpecificity(
      { code: 'H35.119', display: 'Retinopathy of prematurity, stage 0, unspecified eye' },
      ['left eye']
    );
    expect(upgraded.code).toBe('H35.112');
  });
});
