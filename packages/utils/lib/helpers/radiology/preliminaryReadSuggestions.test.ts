import { describe, expect, it } from 'vitest';
import {
  assemblePreliminaryRead,
  buildPreliminaryReadSuggestions,
  findPreliminaryReadRegion,
  findUnpickedBlank,
  PreliminaryReadBlank,
  PreliminaryReadSegment,
} from './preliminaryReadSuggestions';
import { PRELIMINARY_READ_TEMPLATES } from './preliminaryReadTemplates';

const blanks = (segments: PreliminaryReadSegment[]): PreliminaryReadBlank[] =>
  segments.filter((segment): segment is PreliminaryReadBlank => typeof segment !== 'string');

describe('preliminary read templates config', () => {
  it('names a defined choice list (or side) in every blank', () => {
    for (const region of PRELIMINARY_READ_TEMPLATES.regions) {
      for (const template of region.templates) {
        for (const [, name] of template.text.matchAll(/\{(\w+)\}/g)) {
          expect(name === 'side' || name in PRELIMINARY_READ_TEMPLATES.choices, `${region.name}: {${name}}`).toBe(true);
        }
      }
    }
  });

  it('maps each CPT code to a single region, with the negative read first', () => {
    const seen = new Map<string, string>();
    for (const region of PRELIMINARY_READ_TEMPLATES.regions) {
      expect(region.templates[0].name).toBe('Negative');
      for (const code of region.cptCodes) {
        expect(seen.get(code), `${code} in both ${seen.get(code)} and ${region.name}`).toBeUndefined();
        seen.set(code, region.name);
      }
    }
  });

  it('has a childDefault and childOnlyOptions that are among the options wherever they are set', () => {
    for (const list of Object.values(PRELIMINARY_READ_TEMPLATES.choices)) {
      if (list.childDefault) expect(list.options).toContain(list.childDefault);
      for (const option of list.childOnlyOptions ?? []) expect(list.options).toContain(option);
    }
  });
});

describe('findPreliminaryReadRegion', () => {
  it('resolves base codes and strips a laterality suffix', () => {
    expect(findPreliminaryReadRegion('73610')?.name).toBe('Ankle');
    expect(findPreliminaryReadRegion('73630-LT')?.name).toBe('Foot');
    expect(findPreliminaryReadRegion('71046-50')?.name).toBe('Chest');
  });

  it('returns nothing for unmapped or missing codes', () => {
    expect(findPreliminaryReadRegion('99999')).toBeUndefined();
    expect(findPreliminaryReadRegion(undefined)).toBeUndefined();
  });
});

describe('buildPreliminaryReadSuggestions', () => {
  it('fills {side} from the laterality, or offers a side blank with no default when the order fixes none', () => {
    const [, fracture] = buildPreliminaryReadSuggestions({ cptCode: '73610', laterality: 'LT', isChild: false });
    expect(fracture.segments).toContain(' fracture of the left ');
    expect(blanks(fracture.segments).map((b) => b.title)).not.toContain('Side');
    expect(findUnpickedBlank(fracture.segments, [])).toBeUndefined();

    for (const laterality of ['50', undefined] as const) {
      const [, unfixed] = buildPreliminaryReadSuggestions({ cptCode: '73610', laterality, isChild: false });
      const side = blanks(unfixed.segments).find((b) => b.title === 'Side');
      expect(side).toEqual({ title: 'Side', options: ['left', 'right', 'bilateral'], initial: undefined });
      // Blocked until the side is picked; every other blank has a default.
      expect(findUnpickedBlank(unfixed.segments, [])).toBe(side);
      const values: (string | undefined)[] = [];
      values[unfixed.segments.indexOf(side!)] = 'right';
      expect(findUnpickedBlank(unfixed.segments, values)).toBeUndefined();
      expect(assemblePreliminaryRead(unfixed.segments, values)).toBe(
        'Nondisplaced fracture of the right distal fibula (lateral malleolus). Ankle mortise intact.'
      );
    }
  });

  it('drops child-only blanks for adults and applies child defaults for children', () => {
    const adult = buildPreliminaryReadSuggestions({ cptCode: '73100', laterality: 'RT', isChild: false });
    expect(blanks(adult[0].segments).map((b) => b.title)).toEqual(['Opening', 'Incidental finding']);
    expect(blanks(adult[1].segments)[0].initial).toBe('Nondisplaced');

    const child = buildPreliminaryReadSuggestions({ cptCode: '73100', laterality: 'RT', isChild: true });
    expect(blanks(child[0].segments).map((b) => b.title)).toContain('Growth plates (children only)');
    expect(blanks(child[1].segments)[0].initial).toBe('Buckle (torus)');
    expect(blanks(child[1].segments).map((b) => b.initial)).toContain('Growth plate not involved.');
  });

  it('offers the pediatric fracture types to children only, never as an adult option or default', () => {
    const pediatric = ['Buckle (torus)', 'Greenstick', 'Salter-Harris I', 'Salter-Harris II'];
    const fractureTypes = (cptCode: string, isChild: boolean): PreliminaryReadBlank[] =>
      buildPreliminaryReadSuggestions({ cptCode, laterality: 'LT', isChild })
        .flatMap((s) => blanks(s.segments))
        .filter((b) => b.title === 'Fracture type');
    let seen = 0;
    for (const region of PRELIMINARY_READ_TEMPLATES.regions) {
      for (const adult of fractureTypes(region.cptCodes[0], false)) {
        seen++;
        expect(adult.options, region.name).toEqual(adult.options.filter((o) => !pediatric.includes(o)));
        expect(pediatric, region.name).not.toContain(adult.initial);
      }
      for (const child of fractureTypes(region.cptCodes[0], true)) {
        expect(child.options, region.name).toEqual(expect.arrayContaining(pediatric));
      }
    }
    expect(seen).toBeGreaterThan(0);
  });

  it('merges the literals around a fixed side or a dropped blank into single spaces, trimmed at the ends', () => {
    const literals = (cptCode: string, isChild: boolean): string[][] =>
      buildPreliminaryReadSuggestions({ cptCode, laterality: 'RT', isChild }).map((s) =>
        s.segments.filter((segment): segment is string => typeof segment === 'string')
      );
    // Forearm: "{negOpening} Alignment maintained. {incidental} {physes}",
    // "{fxTypeBuckle} fracture of the {side} {forearmBone}. {growthPlate} {wristClose}" and
    // "{fxTypeBuckle} fractures of the {side} distal radius and ulna. {growthPlate} {wristClose}".
    expect(literals('73090', false)).toEqual([
      [' Alignment maintained. '],
      [' fracture of the right ', '. '],
      [' fractures of the right distal radius and ulna. '],
    ]);
    expect(literals('73090', true)).toEqual([
      [' Alignment maintained. ', ' '],
      [' fracture of the right ', '. ', ' '],
      [' fractures of the right distal radius and ulna. ', ' '],
    ]);
  });

  it('returns nothing for an unmapped CPT', () => {
    expect(buildPreliminaryReadSuggestions({ cptCode: '99999', isChild: false })).toEqual([]);
  });
});

describe('assemblePreliminaryRead', () => {
  it('uses defaults, skips (none) blanks and tidies spacing', () => {
    const [negative, fracture] = buildPreliminaryReadSuggestions({
      cptCode: '73610',
      laterality: 'LT',
      isChild: false,
    });
    expect(assemblePreliminaryRead(negative.segments, [])).toBe(
      'No acute fracture or dislocation. Ankle mortise intact.'
    );
    expect(assemblePreliminaryRead(fracture.segments, [])).toBe(
      'Nondisplaced fracture of the left distal fibula (lateral malleolus). Ankle mortise intact.'
    );
  });

  it('builds a clean sentence from the defaults for every region, adult and child, fixed side or not', () => {
    for (const region of PRELIMINARY_READ_TEMPLATES.regions) {
      for (const isChild of [false, true]) {
        for (const laterality of ['LT', '50'] as const) {
          const suggestions = buildPreliminaryReadSuggestions({ cptCode: region.cptCodes[0], laterality, isChild });
          for (const { name, segments } of suggestions) {
            // The only blank without a default is the side; pick it the way the provider would.
            const values = segments.map((s) => (typeof s !== 'string' && s.initial === undefined ? 'left' : undefined));
            const text = assemblePreliminaryRead(segments, values);
            const label = `${region.name} / ${name} / child=${isChild} / ${laterality}`;
            expect(text, label).toMatch(/^[A-Z].*\.$/);
            expect(text, label).not.toMatch(/[{}]|\s{2}|\s\./);
          }
        }
      }
    }
  });

  it('applies the chosen values by segment index', () => {
    const [, fracture] = buildPreliminaryReadSuggestions({ cptCode: '73610', laterality: 'RT', isChild: true });
    const values: (string | undefined)[] = [];
    fracture.segments.forEach((segment, i) => {
      if (typeof segment === 'string') return;
      if (segment.title === 'Bone') values[i] = 'medial malleolus';
      if (segment.title === 'Closing line') values[i] = '';
    });
    expect(assemblePreliminaryRead(fracture.segments, values)).toBe(
      'Salter-Harris I fracture of the right medial malleolus. Growth plate not involved.'
    );
  });
});
