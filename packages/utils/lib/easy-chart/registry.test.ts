// Every assertion in this file caught a real defect in the first implementation. They are the reason
// the registry exists: without them the vocabulary silently drifts apart across the schema, the
// prompt, the validation and the dispatch table, and the only symptom is actions that never work.

import { describe, expect, it } from 'vitest';
import { ACTION_FIELDS, ACTION_KINDS, ActionKind, SURFACES } from './actions';
import { buildStaticInstructions } from './prompt';
import {
  CAPABILITIES,
  capabilitiesForSurface,
  capabilityOf,
  fieldsForSurface,
  hasRequiredFields,
  missingRequiredFields,
  NON_CHART_TARGETS,
} from './registry';
import { buildResponseSchema, buildReviewResponseSchema, findNumberTypedFields, NUMERIC_FIELDS } from './schema';

describe('action registry', () => {
  it('gives every kind exactly one capability entry, and names no kind that does not exist', () => {
    for (const kind of ACTION_KINDS) {
      expect(CAPABILITIES[kind], `no capability for "${kind}"`).toBeDefined();
    }
    expect(Object.keys(CAPABILITIES).sort()).toEqual([...ACTION_KINDS].sort());
  });

  it('declares at least one surface per capability', () => {
    for (const kind of ACTION_KINDS) {
      expect(CAPABILITIES[kind].surfaces.length, `"${kind}" is offered on no surface`).toBeGreaterThan(0);
      for (const surface of CAPABILITIES[kind].surfaces) {
        expect(SURFACES).toContain(surface);
      }
    }
  });

  it('names exactly one write target per kind: a chartField XOR a NON_CHART_TARGETS entry', () => {
    for (const kind of ACTION_KINDS) {
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

  it('uses only known fields in every `required` list', () => {
    for (const kind of ACTION_KINDS) {
      for (const field of CAPABILITIES[kind].required) {
        expect(ACTION_FIELDS, `"${kind}" requires unknown field "${field}"`).toContain(field);
      }
    }
  });

  // The one that mattered most: a required field the surface's schema does not declare means the
  // model can never satisfy it, so 100% of those actions are rejected at runtime and nothing says so.
  it.each(SURFACES)('declares every required field in the %s surface schema', (surface) => {
    const declared = Object.keys(
      ((buildResponseSchema(surface).properties as Record<string, any>).actions.items as Record<string, any>).properties
    );
    for (const kind of capabilitiesForSurface(surface)) {
      for (const field of CAPABILITIES[kind].required) {
        expect(declared, `"${kind}" requires "${field}", which the ${surface} schema does not declare`).toContain(
          field
        );
      }
    }
  });

  it('gives every capability a non-empty promptDoc', () => {
    for (const kind of ACTION_KINDS) {
      expect(CAPABILITIES[kind].promptDoc.trim().length, `"${kind}" has an empty promptDoc`).toBeGreaterThan(0);
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
    const schemaKinds = (
      ((buildResponseSchema(surface).properties as Record<string, any>).actions.items as Record<string, any>).properties
        .kind as Record<string, any>
    ).enum as string[];
    expect(new Set(schemaKinds)).toEqual(offered);
  });
});

describe('hasRequiredFields', () => {
  it('treats a blank string as absent', () => {
    expect(hasRequiredFields('add-diagnosis', { kind: 'add-diagnosis', display: '   ' })).toBe(false);
    expect(hasRequiredFields('add-diagnosis', { kind: 'add-diagnosis', display: 'Acute sinusitis' })).toBe(true);
  });

  it('treats an empty array as absent', () => {
    expect(hasRequiredFields('update-procedure', { kind: 'update-procedure', updates: [] })).toBe(false);
    expect(
      hasRequiredFields('update-procedure', {
        kind: 'update-procedure',
        updates: [{ field: 'bodySide', value: 'right' }],
      })
    ).toBe(true);
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
    const properties = (
      (buildResponseSchema(surface).properties as Record<string, any>).actions.items as Record<string, any>
    ).properties as Record<string, any>;
    for (const field of NUMERIC_FIELDS) {
      if (properties[field]) {
        expect(properties[field].type, `${surface}.${field} must be a string (digit-loop guard)`).toBe('string');
      }
    }
  });

  it.each(SURFACES)('declares exactly the registry field list for the %s surface', (surface) => {
    const declared = Object.keys(
      ((buildResponseSchema(surface).properties as Record<string, any>).actions.items as Record<string, any>).properties
    );
    expect(new Set(declared)).toEqual(new Set(fieldsForSurface(surface)));
  });

  it('keeps property order stable and in ACTION_FIELDS order', () => {
    const declared = Object.keys(
      ((buildResponseSchema('plan').properties as Record<string, any>).actions.items as Record<string, any>).properties
    );
    const expectedOrder = ACTION_FIELDS.filter((f) => declared.includes(f));
    expect(declared).toEqual(expectedOrder);
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
