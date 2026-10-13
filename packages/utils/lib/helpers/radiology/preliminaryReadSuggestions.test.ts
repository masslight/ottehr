import { describe, expect, it } from 'vitest';
import {
  assemblePreliminaryRead,
  buildPreliminaryReadSuggestions,
  findConflictingValue,
  findPreliminaryReadRegion,
  findUnpickedBlank,
  PreliminaryReadBlank,
  PreliminaryReadSegment,
  resolvePreliminaryReadValues,
} from './preliminaryReadSuggestions';
import { PRELIMINARY_READ_TEMPLATES } from './preliminaryReadTemplates';

const PEDIATRIC_TYPES = ['buckle (torus)', 'greenstick', 'Salter-Harris I', 'Salter-Harris II'];
const LOCATION_TITLES = ['Side', 'Bone', 'Site', 'Rib', 'Level', 'Location', 'Ray', 'Phalanx', 'Finger', 'Toe'];

const blanks = (segments: PreliminaryReadSegment[]): PreliminaryReadBlank[] =>
  segments.filter((segment): segment is PreliminaryReadBlank => typeof segment !== 'string');

const indexOfBlank = (segments: PreliminaryReadSegment[], title: string): number =>
  segments.findIndex((segment) => typeof segment !== 'string' && segment.title === title);

const valuesFor = (segments: PreliminaryReadSegment[], picks: Record<string, string>): (string | undefined)[] =>
  segments.map((segment) => (typeof segment !== 'string' && segment.title in picks ? picks[segment.title] : undefined));

const pickRequired = (segments: PreliminaryReadSegment[]): (string | undefined)[] => {
  const values: (string | undefined)[] = segments.map(() => undefined);
  segments.forEach((segment, i) => {
    if (typeof segment === 'string' || segment.initial !== undefined) return;
    values[i] = segment.options.find((option) => !findConflictingValue(values, i, option));
  });
  return values;
};

const allSuggestions = function* (): Generator<{
  label: string;
  segments: PreliminaryReadSegment[];
}> {
  for (const region of PRELIMINARY_READ_TEMPLATES.regions) {
    for (const isChild of [false, true]) {
      for (const laterality of ['LT', '50', undefined] as const) {
        for (const { name, segments } of buildPreliminaryReadSuggestions({
          cptCode: region.cptCodes[0],
          laterality,
          isChild,
        })) {
          yield { label: `${region.name} / ${name} / child=${isChild} / ${laterality}`, segments };
        }
      }
    }
  }
};

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

  it('only names real options in conflicts, so a typo cannot silently disable a rule', () => {
    const options = new Set(Object.values(PRELIMINARY_READ_TEMPLATES.choices).flatMap((list) => list.options));
    for (const pair of PRELIMINARY_READ_TEMPLATES.conflicts) {
      for (const value of pair) expect(options, value).toContain(value);
    }
  });

  it('never starts a sentence on two values that conflict', () => {
    for (const { label, segments } of allSuggestions()) {
      const defaults = segments.map((segment) => (typeof segment === 'string' ? undefined : segment.initial));
      defaults.forEach((value, i) => {
        if (value !== undefined) expect(findConflictingValue(defaults, i, value), label).toBeUndefined();
      });
    }
  });
});

describe('findPreliminaryReadRegion', () => {
  it('resolves base codes and strips a laterality suffix', () => {
    expect(findPreliminaryReadRegion('73610')?.name).toBe('Ankle');
    expect(findPreliminaryReadRegion('73630-LT')?.name).toBe('Foot');
    expect(findPreliminaryReadRegion('71046-50')?.name).toBe('Chest');
  });

  it('keeps facial and nasal studies apart so the negative read names the bones imaged', () => {
    const negative = (cptCode: string): string =>
      assemblePreliminaryRead(buildPreliminaryReadSuggestions({ cptCode, isChild: false })[0].segments, []);

    expect(negative('70140')).toBe('No acute fracture of the facial bones.');
    expect(negative('70150')).toBe('No acute fracture of the facial bones.');
    expect(negative('70160')).toBe('No acute fracture of the nasal bones.');
  });

  it('returns nothing for unmapped or missing codes', () => {
    expect(findPreliminaryReadRegion('99999')).toBeUndefined();
    expect(findPreliminaryReadRegion(undefined)).toBeUndefined();
  });
});

describe('buildPreliminaryReadSuggestions', () => {
  it('fills {side} from the laterality, or offers a left/right blank with no default when the order fixes none', () => {
    const [, fracture] = buildPreliminaryReadSuggestions({ cptCode: '73610', laterality: 'LT', isChild: false });
    expect(fracture.segments).toContain(' fracture of the left ');
    expect(blanks(fracture.segments).map((b) => b.title)).not.toContain('Side');

    for (const laterality of ['50', undefined] as const) {
      const [, unfixed] = buildPreliminaryReadSuggestions({ cptCode: '73610', laterality, isChild: false });
      const side = blanks(unfixed.segments).find((b) => b.title === 'Side');
      expect(side).toEqual({ title: 'Side', options: ['left', 'right'], initial: undefined });
      expect(findUnpickedBlank(unfixed.segments, [])).toBe(side);
      const values = valuesFor(unfixed.segments, { Side: 'right', Bone: 'distal fibula (lateral malleolus)' });
      expect(findUnpickedBlank(unfixed.segments, values)).toBeUndefined();
      expect(assemblePreliminaryRead(unfixed.segments, values)).toBe(
        'Nondisplaced fracture of the right distal fibula (lateral malleolus). Ankle mortise intact.'
      );
    }
  });

  it('makes every blank that says where the finding is a must-pick, and nothing else', () => {
    for (const { label, segments } of allSuggestions()) {
      for (const blank of blanks(segments)) {
        expect(blank.initial === undefined, `${label} / ${blank.title}`).toBe(LOCATION_TITLES.includes(blank.title));
      }
    }

    for (const region of PRELIMINARY_READ_TEMPLATES.regions) {
      const [negative] = buildPreliminaryReadSuggestions({
        cptCode: region.cptCodes[0],
        laterality: 'LT',
        isChild: true,
      });

      expect(findUnpickedBlank(negative.segments, []), region.name).toBeUndefined();
    }
  });

  it('keeps displacement and fracture type as separate blanks', () => {
    const [, fracture] = buildPreliminaryReadSuggestions({ cptCode: '73100', laterality: 'RT', isChild: false });
    const values = valuesFor(fracture.segments, {
      Displacement: 'Displaced',
      'Fracture type': 'comminuted',
      Bone: 'distal radius',
    });
    expect(assemblePreliminaryRead(fracture.segments, values)).toBe(
      'Displaced comminuted fracture of the right distal radius.'
    );
  });

  it('drops child-only blanks for adults; for children the growth-plate lines are offered but start empty', () => {
    const adult = buildPreliminaryReadSuggestions({ cptCode: '73100', laterality: 'RT', isChild: false });
    expect(blanks(adult[0].segments).map((b) => b.title)).toEqual(['Opening', 'Incidental finding']);
    expect(blanks(adult[1].segments).map((b) => [b.title, b.initial])).toEqual([
      ['Displacement', 'Nondisplaced'],
      ['Fracture type', ''],
      ['Bone', undefined],
      ['Closing line', 'No dislocation. Alignment maintained.'],
    ]);

    const child = buildPreliminaryReadSuggestions({ cptCode: '73100', laterality: 'RT', isChild: true });
    const physes = blanks(child[0].segments).find((b) => b.title === 'Growth plates (children only)');
    expect(physes?.initial).toBe('');
    const fracture = blanks(child[1].segments);
    expect(fracture.find((b) => b.title === 'Fracture type')?.initial).toBe('buckle (torus)');
    expect(fracture.find((b) => b.title === 'Growth plate (children only)')?.initial).toBe('');
  });

  it('offers the pediatric fracture types to children only, and only for growing tubular bones', () => {
    const nonTubular = ['Ribs', 'Sacrum and coccyx', 'Pelvis and hip', 'Heel', 'Facial bones', 'Nasal bones'];
    const fractureTypes = (cptCode: string, isChild: boolean): PreliminaryReadBlank[] =>
      buildPreliminaryReadSuggestions({ cptCode, laterality: 'LT', isChild })
        .flatMap((s) => blanks(s.segments))
        .filter((b) => b.title === 'Fracture type');
    let seen = 0;
    for (const region of PRELIMINARY_READ_TEMPLATES.regions) {
      for (const adult of fractureTypes(region.cptCodes[0], false)) {
        seen++;
        expect(
          adult.options.filter((o) => PEDIATRIC_TYPES.includes(o)),
          region.name
        ).toEqual([]);
        expect(PEDIATRIC_TYPES, region.name).not.toContain(adult.initial);
      }
      for (const child of fractureTypes(region.cptCodes[0], true)) {
        if (nonTubular.includes(region.name)) {
          expect(
            child.options.filter((o) => PEDIATRIC_TYPES.includes(o)),
            region.name
          ).toEqual([]);
        } else {
          expect(child.options, region.name).toEqual(expect.arrayContaining(PEDIATRIC_TYPES));
        }
      }
    }
    expect(seen).toBeGreaterThan(0);
  });

  it('merges the literals around a fixed side or a dropped blank into single spaces, trimmed at the ends', () => {
    const literals = (cptCode: string, isChild: boolean): string[][] =>
      buildPreliminaryReadSuggestions({ cptCode, laterality: 'RT', isChild }).map((s) =>
        s.segments.filter((segment): segment is string => typeof segment === 'string')
      );

    expect(literals('73090', false)).toEqual([
      [' Alignment maintained. '],
      [' ', ' fracture of the right ', '. '],
      [' ', ' fractures of the right distal radius and ulna. '],
    ]);

    expect(literals('73090', true)).toEqual([
      [' Alignment maintained. ', ' '],
      [' ', ' fracture of the right ', '. ', ' '],
      [' ', ' fractures of the right distal radius and ulna. ', ' '],
    ]);
  });

  it('returns nothing for an unmapped CPT', () => {
    expect(buildPreliminaryReadSuggestions({ cptCode: '99999', isChild: false })).toEqual([]);
  });
});

describe('findConflictingValue', () => {
  it('blocks a growth-plate line next to a picked Salter-Harris fracture, and the other way round', () => {
    const [, fracture] = buildPreliminaryReadSuggestions({ cptCode: '73610', laterality: 'LT', isChild: true });
    const type = indexOfBlank(fracture.segments, 'Fracture type');
    const plate = indexOfBlank(fracture.segments, 'Growth plate (children only)');

    const withSalter = valuesFor(fracture.segments, { 'Fracture type': 'Salter-Harris I' });
    expect(findConflictingValue(withSalter, plate, 'Growth plate not involved.')).toBe('Salter-Harris I');
    expect(findConflictingValue(withSalter, plate, 'Extends to the growth plate.')).toBe('Salter-Harris I');
    expect(findConflictingValue(withSalter, plate, '')).toBeUndefined();

    const withLine = valuesFor(fracture.segments, { 'Growth plate (children only)': 'Growth plate not involved.' });
    expect(findConflictingValue(withLine, type, 'Salter-Harris II')).toBe('Growth plate not involved.');
    expect(findConflictingValue(withLine, type, 'greenstick')).toBeUndefined();
  });

  it('does not block anything because of a default: defaults give way instead', () => {
    // The child ankle starts on Salter-Harris I, but that is only a default.
    const [, fracture] = buildPreliminaryReadSuggestions({ cptCode: '73610', laterality: 'LT', isChild: true });
    const plate = indexOfBlank(fracture.segments, 'Growth plate (children only)');
    expect(findConflictingValue([], plate, 'Growth plate not involved.')).toBeUndefined();
  });

  it('does not offer a middle phalanx for the thumb, the great toe or the 1st ray of the foot', () => {
    const check = (cptCode: string, row: number, otherTitle: string, other: string): void => {
      const { segments } = buildPreliminaryReadSuggestions({ cptCode, laterality: 'LT', isChild: false })[row];
      const phalanxTitle = indexOfBlank(segments, 'Phalanx') >= 0 ? 'Phalanx' : 'Bone';
      const phalanx = indexOfBlank(segments, phalanxTitle);
      const otherIndex = indexOfBlank(segments, otherTitle);
      const withOther = valuesFor(segments, { [otherTitle]: other });
      expect(findConflictingValue(withOther, phalanx, 'middle phalanx')).toBe(other);
      expect(findConflictingValue(withOther, phalanx, 'proximal phalanx')).toBeUndefined();
      const withMiddle = valuesFor(segments, { [phalanxTitle]: 'middle phalanx' });
      expect(findConflictingValue(withMiddle, otherIndex, other)).toBe('middle phalanx');
    };
    check('73140', 1, 'Finger', 'thumb');
    check('73120', 2, 'Finger', 'thumb');
    check('73660', 1, 'Toe', 'great toe');
    check('73630', 1, 'Ray', '1st');
  });
});

describe('resolvePreliminaryReadValues', () => {
  const sentence = (
    cptCode: string,
    row: number,
    isChild: boolean,
    picks: Record<string, string>,
    laterality: 'LT' | 'RT' = 'LT'
  ): string => {
    const { segments } = buildPreliminaryReadSuggestions({ cptCode, laterality, isChild })[row];
    return assemblePreliminaryRead(segments, valuesFor(segments, picks));
  };

  it('drops the default "Alignment maintained" closing line for a displaced or angulated fracture, without adding another claim', () => {
    expect(sentence('73100', 1, false, { Bone: 'distal radius' })).toBe(
      'Nondisplaced fracture of the left distal radius. No dislocation. Alignment maintained.'
    );
    expect(sentence('73100', 1, false, { Displacement: 'Displaced', Bone: 'distal radius' })).toBe(
      'Displaced fracture of the left distal radius.'
    );
    expect(sentence('73560', 1, false, { Displacement: 'Angulated', Bone: 'patella' })).toBe(
      'Angulated fracture of the left patella.'
    );
  });

  it('drops a default buckle type when the fracture is displaced', () => {
    expect(sentence('73100', 1, true, { Displacement: 'Displaced', Bone: 'distal radius' })).toBe(
      'Displaced fracture of the left distal radius.'
    );
  });

  it('drops a default child fracture type on a bone that is not a growing tubular bone', () => {
    expect(sentence('73100', 1, true, { Bone: 'distal radius' })).toBe(
      'Nondisplaced buckle (torus) fracture of the left distal radius. No dislocation. Alignment maintained.'
    );
    expect(sentence('73100', 1, true, { Bone: 'scaphoid' })).toBe(
      'Nondisplaced fracture of the left scaphoid. No dislocation. Alignment maintained.'
    );
    expect(sentence('73610', 1, true, { Bone: 'base of the 5th metatarsal' })).toBe(
      'Nondisplaced fracture of the left base of the 5th metatarsal. Ankle mortise intact.'
    );
  });

  it('drops a default Salter-Harris type when the provider states the growth plate is not involved', () => {
    expect(sentence('73610', 1, true, { Bone: 'distal tibia' })).toBe(
      'Nondisplaced Salter-Harris I fracture of the left distal tibia. Ankle mortise intact.'
    );
    expect(
      sentence('73610', 1, true, { Bone: 'distal tibia', 'Growth plate (children only)': 'Growth plate not involved.' })
    ).toBe('Nondisplaced fracture of the left distal tibia. Growth plate not involved. Ankle mortise intact.');
  });

  it('does not call an opacity in both lungs focal', () => {
    expect(sentence('71046', 1, false, { Location: 'both lungs' })).toBe(
      'Patchy airspace opacities in both lungs concerning for pneumonia. No pleural effusion or pneumothorax.'
    );
  });

  it('never leaves two clashing values in a sentence after any single pick', () => {
    const clashes: string[] = [];
    for (const { label, segments } of allSuggestions()) {
      segments.forEach((segment, i) => {
        if (typeof segment === 'string') return;
        for (const option of segment.options) {
          const picks: (string | undefined)[] = segments.map(() => undefined);
          picks[i] = option;
          const resolved = resolvePreliminaryReadValues(segments, picks);
          resolved.forEach((value, j) => {
            if (value !== undefined && findConflictingValue(resolved, j, value)) {
              clashes.push(`${label}: ${segment.title}=${option} -> ${value}`);
            }
          });
        }
      });
    }
    expect(clashes.slice(0, 5)).toEqual([]);
  });

  it("keeps the provider's picks as they are", () => {
    const [, fracture] = buildPreliminaryReadSuggestions({ cptCode: '73100', laterality: 'LT', isChild: false });
    const picks = valuesFor(fracture.segments, { Displacement: 'Displaced', 'Closing line': 'No dislocation.' });
    const resolved = resolvePreliminaryReadValues(fracture.segments, picks);
    picks.forEach((pick, i) => {
      if (pick !== undefined) expect(resolved[i]).toBe(pick);
    });
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
    expect(assemblePreliminaryRead(fracture.segments, valuesFor(fracture.segments, { Bone: 'medial malleolus' }))).toBe(
      'Nondisplaced fracture of the left medial malleolus. Ankle mortise intact.'
    );
  });

  it('builds a clean sentence for every region, adult and child, fixed side or not', () => {
    for (const { label, segments } of allSuggestions()) {
      const values = pickRequired(segments);
      expect(findUnpickedBlank(segments, values), label).toBeUndefined();
      const text = assemblePreliminaryRead(segments, values);
      expect(text, label).toMatch(/^[A-Z].*\.$/);
      expect(text, label).not.toMatch(/[{}]|\s{2}|\s\.|\bthe the\b|\bthe both\b|\bthe bilateral\b/);
    }
  });

  it('builds a clean sentence for every combination a provider can pick', () => {
    let sentences = 0;
    const malformed: string[] = [];
    for (const { label, segments } of allSuggestions()) {
      const blankIndexes = segments.flatMap((segment, i) => (typeof segment === 'string' ? [] : [i]));
      const walk = (k: number, values: (string | undefined)[]): void => {
        if (k === blankIndexes.length) {
          // Reachable only if no picked value clashes with another (the list doesn't offer clashing ones).
          if (blankIndexes.some((i) => findConflictingValue(values, i, values[i]!))) return;
          sentences++;
          const text = assemblePreliminaryRead(segments, values);
          if (!/^[A-Z][^{}]*\.$/.test(text) || /\s{2}|\s\.|\bthe (the|both|bilateral)\b/.test(text)) {
            malformed.push(`${label}: ${text}`);
          }
          return;
        }
        const i = blankIndexes[k];
        for (const option of (segments[i] as PreliminaryReadBlank).options) {
          const next = [...values];
          next[i] = option;
          walk(k + 1, next);
        }
      };
      walk(
        0,
        segments.map(() => undefined)
      );
    }
    expect(malformed.slice(0, 5)).toEqual([]);
    expect(sentences).toBeGreaterThan(0);
  });

  it('applies the chosen values by segment index', () => {
    const [, fracture] = buildPreliminaryReadSuggestions({ cptCode: '73610', laterality: 'RT', isChild: true });
    const values = valuesFor(fracture.segments, { Bone: 'medial malleolus', 'Closing line': '' });
    expect(assemblePreliminaryRead(fracture.segments, values)).toBe(
      'Nondisplaced Salter-Harris I fracture of the right medial malleolus.'
    );
  });
});
