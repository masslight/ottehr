import { describe, expect, it } from 'vitest';
import { ACTION_FIELDS, ACTION_KINDS, ActionKind, SURFACES } from './actions';
import { buildStaticInstructions } from './prompt';
import {
  allowedFields,
  CAPABILITIES,
  capabilitiesForSurface,
  capabilityOf,
  declaredFields,
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
  it('has exactly one capability per kind', () => {
    expect(Object.keys(CAPABILITIES).sort()).toEqual([...ACTION_KINDS].sort());
  });

  it('declares at least one surface per capability', () => {
    for (const kind of ACTION_KINDS) {
      expect(capabilityOf(kind).surfaces.length, `"${kind}" is offered on no surface`).toBeGreaterThan(0);
      for (const surface of capabilityOf(kind).surfaces) {
        expect(SURFACES).toContain(surface);
      }
    }
  });

  it('names exactly one write target per kind: a chartField XOR a NON_CHART_TARGETS entry', () => {
    for (const kind of ACTION_KINDS) {
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
    for (const kind of ACTION_KINDS) {
      for (const field of declaredFields(kind)) {
        expect(ACTION_FIELDS, `"${kind}" declares unknown field "${field}"`).toContain(field);
      }
    }
  });

  // A required field the schema does not declare could never be satisfied by the model.
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
    for (const kind of ACTION_KINDS) {
      expect(capabilityOf(kind).promptDoc.trim().length, `"${kind}" has an empty promptDoc`).toBeGreaterThan(0);
    }
  });

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

  it('treats every blank required field as missing', () => {
    expect(missingRequiredFields('edit-note-text', { kind: 'edit-note-text', field: '', newText: ' ' })).toEqual([
      'field',
      'newText',
    ]);
  });

  it('accepts a kind with no required fields', () => {
    expect(hasRequiredFields('unknown', { kind: 'unknown' })).toBe(true);
  });

  it('reports which fields are missing, so a skipped step can say why', () => {
    expect(missingRequiredFields('set-vital', { kind: 'set-vital', field: 'vital-height' })).toEqual(['display']);
    expect(missingRequiredFields('edit-note-text', { kind: 'edit-note-text' })).toEqual(['field', 'newText']);
  });
});

describe('response schemas', () => {
  // Trap 1: a JSON number has no closing token, so a digit run can loop to the output cap.
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

  it('offers remove-* actions on the review surface only', () => {
    expect(capabilitiesForSurface('plan').filter((kind) => kind.startsWith('remove-'))).toEqual([]);
    expect(capabilitiesForSurface('review')).toEqual(expect.arrayContaining(['remove-diagnosis', 'remove-medication']));
  });

  it('offers the review surface a strictly narrower vocabulary than the planner', () => {
    const plan = new Set(capabilitiesForSurface('plan'));
    const review = capabilitiesForSurface('review');
    expect(review.length).toBeLessThan(plan.size);
    expect(review).not.toContain('apply-template');
    expect(review).not.toContain('set-vital');
    expect(review).not.toContain('add-exam-finding');
  });
});

describe('generated prompt shape', () => {
  it.each(ACTION_KINDS)('%s: the shape line names every declared field and nothing else', (kind) => {
    const line = shapeLine(kind);
    const named = line
      .slice(line.indexOf('{') + 1, line.lastIndexOf('}'))
      .split(',')
      .map((s) => s.trim());
    expect(new Set(named)).toEqual(new Set(['kind', ...declaredFields(kind)]));
  });

  it.each(ACTION_KINDS)('%s: every field carries a description the model reads', (kind) => {
    for (const [field, schema] of Object.entries(capabilityOf(kind).shape.shape)) {
      expect(schema.description?.trim().length, `"${kind}.${field}" has no .describe()`).toBeGreaterThan(0);
    }
  });

  it('no promptDoc still carries a hand-written shape line', () => {
    for (const kind of ACTION_KINDS) expect(capabilityOf(kind).promptDoc.trimStart().startsWith('- ')).toBe(false);
  });
});

describe('prompt structure', () => {
  it.each(SURFACES)('puts the static instruction block before the variable tail on %s', (surface) => {
    const instructions = buildStaticInstructions(surface);
    // Nothing per-call may appear in the cacheable prefix.
    expect(instructions).not.toContain('ALREADY ON THE CHART:\n');
    expect(instructions).not.toContain('AVAILABLE TEMPLATES in this practice:');
  });

  it('is deterministic — same registry in, same bytes out', () => {
    expect(buildStaticInstructions('plan')).toBe(buildStaticInstructions('plan'));
  });
});

// Under constrained decoding a category missing from the enum is not dropped but mislabelled, so the
// prompt's numbered checks and the schema enum must list the same categories.
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
