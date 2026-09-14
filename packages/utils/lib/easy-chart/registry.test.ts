// Every assertion in this file caught a real defect in the first implementation. They are the reason
// the registry exists: without them the vocabulary silently drifts apart across the schema, the
// prompt, the validation and the dispatch table, and the only symptom is actions that never work.

import { describe, expect, it } from 'vitest';
import { ACTION_FIELDS, ACTION_KINDS, ActionKind, SURFACES } from './actions';
import { buildStaticInstructions } from './prompt';
import {
  allowedFields,
  CAPABILITIES,
  capabilitiesForSurface,
  capabilityOf,
  declaredFields,
  DISABLED_KINDS,
  ENABLED_KINDS,
  hasRequiredFields,
  missingRequiredFields,
  NON_CHART_TARGETS,
  requiredFields,
  shapeLine,
} from './registry';
import {
  actionBranchesOf,
  buildResponseSchema,
  buildReviewResponseSchema,
  findNumberTypedFields,
  NUMERIC_FIELDS,
} from './schema';

describe('action registry', () => {
  it('names no capability that is not a kind, and every kind is either enabled or disabled', () => {
    for (const key of Object.keys(CAPABILITIES)) expect(ACTION_KINDS).toContain(key);
    expect([...ENABLED_KINDS, ...DISABLED_KINDS].sort()).toEqual([...ACTION_KINDS].sort());
  });

  // Disabling a kind is commenting its CAPABILITIES entry out. That must stay a conscious act, so the
  // disabled set is spelled out here: change this list when you change the registry.
  it('disables exactly the kinds this build means to disable', () => {
    expect([...DISABLED_KINDS].sort()).toEqual([
      'add-cpt',
      'add-external-lab',
      'add-in-house-lab',
      'add-nursing-order',
      'add-procedure',
      'add-radiology',
      'remove-allergy',
      'remove-condition',
      'remove-cpt',
      'remove-em-code',
      'remove-exam-finding',
      'remove-hospitalization',
      'remove-ros-finding',
      'remove-surgical-history',
      'update-procedure',
    ]);
    for (const kind of DISABLED_KINDS) {
      expect(() => capabilityOf(kind)).toThrow(/disabled/);
      for (const surface of SURFACES) expect(capabilitiesForSurface(surface)).not.toContain(kind);
    }
  });

  it('declares at least one surface per capability', () => {
    for (const kind of ENABLED_KINDS) {
      expect(capabilityOf(kind).surfaces.length, `"${kind}" is offered on no surface`).toBeGreaterThan(0);
      for (const surface of capabilityOf(kind).surfaces) {
        expect(SURFACES).toContain(surface);
      }
    }
  });

  it('names exactly one write target per kind: a chartField XOR a NON_CHART_TARGETS entry', () => {
    for (const kind of ENABLED_KINDS) {
      // Through the accessor: CAPABILITIES is `as const satisfies`, so an entry WITHOUT a chartField
      // has no such property to read off the union. capabilityOf exists for exactly this.
      const hasChartField = capabilityOf(kind).chartField != null;
      const hasNonChartTarget = NON_CHART_TARGETS[kind] != null;
      expect(
        hasChartField !== hasNonChartTarget,
        `"${kind}" must declare a chartField or a NON_CHART_TARGETS entry, and not both ` +
          `(chartField=${hasChartField}, nonChart=${hasNonChartTarget})`
      ).toBe(true);
    }
  });

  it('names no kind in NON_CHART_TARGETS that does not exist', () => {
    for (const kind of Object.keys(NON_CHART_TARGETS)) {
      expect(ACTION_KINDS, `NON_CHART_TARGETS names unknown kind "${kind}"`).toContain(kind as ActionKind);
    }
  });

  it('declares only fields ACTION_FIELDS knows, so the wire property order covers every field', () => {
    for (const kind of ENABLED_KINDS) {
      for (const field of declaredFields(kind)) {
        expect(ACTION_FIELDS, `"${kind}" declares unknown field "${field}"`).toContain(field);
      }
    }
  });

  // The one that mattered most: a required field the surface's schema does not declare means the
  // model can never satisfy it, so 100% of those actions are rejected at runtime and nothing says so.
  // With one branch per kind this holds by construction; the test pins the construction.
  it.each(SURFACES)('declares every required field in every %s branch', (surface) => {
    const branches = actionBranchesOf(buildResponseSchema(surface));
    for (const kind of capabilitiesForSurface(surface)) {
      for (const field of requiredFields(kind)) {
        expect(Object.keys(branches[kind].properties), `"${kind}" requires "${field}"`).toContain(field);
        expect(branches[kind].required, `"${kind}" requires "${field}"`).toContain(field);
      }
    }
  });

  it('gives every capability a non-empty promptDoc', () => {
    for (const kind of ENABLED_KINDS) {
      expect(capabilityOf(kind).promptDoc.trim().length, `"${kind}" has an empty promptDoc`).toBeGreaterThan(0);
    }
  });

  // Five actions existed in the schemas but were described in no prompt in the first implementation.
  // The model could never emit them, and nothing anywhere said so.
  it.each(SURFACES)('mentions every action the %s surface offers in that surface prompt', (surface) => {
    const prompt = buildStaticInstructions(surface);
    for (const kind of capabilitiesForSurface(surface)) {
      expect(prompt, `the ${surface} prompt never mentions "${kind}"`).toContain(kind);
    }
  });

  it.each(SURFACES)('never mentions an action the %s surface does not offer as an emittable kind', (surface) => {
    const offered = new Set<string>(capabilitiesForSurface(surface));
    const schemaKinds = Object.keys(actionBranchesOf(buildResponseSchema(surface)));
    expect(new Set(schemaKinds)).toEqual(offered);
  });
});

describe('hasRequiredFields', () => {
  it('treats a blank string as absent', () => {
    expect(hasRequiredFields('add-diagnosis', { kind: 'add-diagnosis', display: '   ' })).toBe(false);
    expect(hasRequiredFields('add-diagnosis', { kind: 'add-diagnosis', display: 'Acute sinusitis' })).toBe(true);
  });

  // `update-procedure` used to pin the empty-array rule (`updates: []` is absent). It is disabled in this
  // build, and no enabled kind requires an array, so the rule is exercised through `isPresent` indirectly
  // only; what IS pinned here is the disabled-kind contract the executor relies on.
  it('requires nothing of a disabled kind, so a stale server action still reaches its handler', () => {
    expect(hasRequiredFields('update-procedure', { kind: 'update-procedure', updates: [] })).toBe(true);
    expect(missingRequiredFields('update-procedure', { kind: 'update-procedure' })).toEqual([]);
  });

  it('accepts a kind with no required fields', () => {
    expect(hasRequiredFields('unknown', { kind: 'unknown' })).toBe(true);
    expect(hasRequiredFields('remove-em-code', { kind: 'remove-em-code' })).toBe(true);
  });

  it('reports which fields are missing, so a skipped step can say why', () => {
    expect(missingRequiredFields('set-vital', { kind: 'set-vital', field: 'vital-height' })).toEqual(['display']);
    expect(missingRequiredFields('edit-note-text', { kind: 'edit-note-text' })).toEqual(['field', 'newText']);
  });
});

describe('response schemas', () => {
  // THE digit-loop guard. A JSON number has no closing token under constrained decoding, so a stray
  // numeric field self-reinforces to the output cap: 31% of calls died at MAX_TOKENS this way.
  it.each(SURFACES)('declares no numeric field anywhere in the %s schema', (surface) => {
    expect(findNumberTypedFields(buildResponseSchema(surface))).toEqual([]);
  });

  it.each(SURFACES)('declares every numeric-contract field as a string in the %s schema', (surface) => {
    for (const branch of Object.values(actionBranchesOf(buildResponseSchema(surface)))) {
      for (const field of NUMERIC_FIELDS) {
        if (branch.properties[field])
          expect(branch.properties[field].type, `${field} (digit-loop guard)`).toBe('string');
      }
    }
  });

  it('derives the numeric list from the guardedNumber declarations', () => {
    expect(NUMERIC_FIELDS).toEqual(['followUpInDays']);
  });

  it.each(SURFACES)(
    'gives every %s branch exactly the allowed fields of its kind, kind first and sourceText last',
    (surface) => {
      for (const [kind, branch] of Object.entries(actionBranchesOf(buildResponseSchema(surface)))) {
        const declared = Object.keys(branch.properties);
        expect(new Set(declared)).toEqual(new Set(allowedFields(kind as ActionKind)));
        expect(declared[0]).toBe('kind');
        expect(declared[declared.length - 1]).toBe('sourceText');
        // ACTION_FIELDS order in between: the serialized schema is part of the cached prompt prefix.
        expect(declared).toEqual(ACTION_FIELDS.filter((f) => declared.includes(f)));
        expect(branch.required[0]).toBe('kind');
        expect(branch.required).toEqual(expect.arrayContaining(requiredFields(kind as ActionKind)));
      }
    }
  );

  it('keeps branch order stable and in ACTION_KINDS order', () => {
    const kinds = Object.keys(actionBranchesOf(buildResponseSchema('plan')));
    expect(kinds).toEqual(ACTION_KINDS.filter((k) => kinds.includes(k)));
  });

  it("offers no remove-* action on any authoring surface — removals are the review pass's tool", () => {
    for (const surface of SURFACES.filter((s) => s !== 'review')) {
      expect(capabilitiesForSurface(surface).filter((kind) => kind.startsWith('remove-'))).toEqual([]);
    }
    expect(capabilitiesForSurface('review')).toEqual(expect.arrayContaining(['remove-diagnosis', 'remove-medication']));
  });

  it('offers the review surface a strictly narrower vocabulary than the planner', () => {
    const plan = new Set(capabilitiesForSurface('plan'));
    const review = capabilitiesForSurface('review');
    expect(review.length).toBeLessThan(plan.size);
    // The review pass corrects a note; it must not be able to apply a template or set vitals.
    expect(review).not.toContain('apply-template');
    expect(review).not.toContain('set-vital');
    expect(review).not.toContain('add-exam-finding');
  });
});

describe('generated prompt shape', () => {
  // The shape line is generated from the keys, so the drift the first registry had (add-ros-finding
  // offered `finding` in the schema and never said so) cannot recur.
  it.each(ENABLED_KINDS)('%s: the shape line names every declared field and nothing else', (kind) => {
    const line = shapeLine(kind);
    const named = line
      .slice(line.indexOf('{') + 1, line.lastIndexOf('}'))
      .split(',')
      .map((s) => s.trim());
    expect(new Set(named)).toEqual(new Set(['kind', ...declaredFields(kind)]));
  });

  it.each(ENABLED_KINDS)('%s: every field carries a description the model reads', (kind) => {
    for (const [field, schema] of Object.entries(capabilityOf(kind).shape.shape)) {
      expect(schema.description?.trim().length, `"${kind}.${field}" has no .describe()`).toBeGreaterThan(0);
    }
  });

  it('no promptDoc still carries a hand-written shape line', () => {
    for (const kind of ENABLED_KINDS) expect(capabilityOf(kind).promptDoc.trimStart().startsWith('- ')).toBe(false);
  });
});

describe('prompt structure', () => {
  it.each(SURFACES)('puts the static instruction block before the variable tail on %s', (surface) => {
    const instructions = buildStaticInstructions(surface);
    // Nothing per-call may appear in the cacheable prefix. These are the placeholders the tail owns.
    expect(instructions).not.toContain('ALREADY ON THE CHART:\n');
    expect(instructions).not.toContain('AVAILABLE TEMPLATES in this practice:');
  });

  it('is deterministic — same registry in, same bytes out', () => {
    expect(buildStaticInstructions('plan')).toBe(buildStaticInstructions('plan'));
  });
});

// The review surface's CATEGORY vocabulary. The prompt numbers its checks and names a category for each;
// the schema constrains the field to an enum. Nothing tied the two together, and the failure is silent in
// the worst way: under constrained decoding a model told to emit an eleventh category cannot return it, so
// it is forced into one of the existing ten and the finding arrives MIS-LABELLED rather than missing. Add a
// check to the prompt, add it to the enum.
describe('review categories', () => {
  const categoriesInSchema = (): string[] => {
    const suggestions = (buildReviewResponseSchema().properties as Record<string, any>).suggestions;
    return ((suggestions.items as Record<string, any>).properties.category as { enum: string[] }).enum;
  };

  it('offers exactly the categories the review prompt describes', () => {
    const prompt = buildStaticInstructions('review');
    // The prompt writes each check as `N) "category-name"`.
    const inPrompt = [...prompt.matchAll(/^\d+\)\s*"([a-z-]+)"/gm)].map((m) => m[1]);
    expect(inPrompt.length, 'the review prompt lists no numbered checks — did its shape change?').toBeGreaterThan(0);
    expect([...categoriesInSchema()].sort()).toEqual([...new Set(inPrompt)].sort());
  });

  it('names every schema category somewhere in the prompt', () => {
    const prompt = buildStaticInstructions('review');
    for (const category of categoriesInSchema()) {
      expect(prompt, `the review prompt never mentions the "${category}" category`).toContain(category);
    }
  });
});
