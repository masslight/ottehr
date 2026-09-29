import { describe, expect, it } from 'vitest';
import { ACTION_FIELDS, ACTION_KINDS, ActionKind } from './actions';
import { buildStaticInstructions } from './prompt';
import {
  allowedFields,
  CAPABILITIES,
  capabilityOf,
  declaredFields,
  hasRequiredFields,
  missingRequiredFields,
  requiredFields,
  shapeLine,
} from './registry';
import { actionBranchesOf, buildResponseSchema, findNumberTypedFields } from './schema';

describe('action registry', () => {
  it('has exactly one capability per kind', () => {
    expect(Object.keys(CAPABILITIES).sort()).toEqual([...ACTION_KINDS].sort());
  });

  it('declares only fields ACTION_FIELDS knows, so the wire property order covers every field', () => {
    for (const kind of ACTION_KINDS) {
      for (const field of declaredFields(kind)) {
        expect(ACTION_FIELDS, `"${kind}" declares unknown field "${field}"`).toContain(field);
      }
    }
  });

  // A required field the schema does not declare could never be satisfied by the model.
  it('declares every required field in its schema branch', () => {
    const branches = actionBranchesOf(buildResponseSchema());
    for (const kind of ACTION_KINDS) {
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

  it('mentions every action kind in the prompt', () => {
    const prompt = buildStaticInstructions();
    for (const kind of ACTION_KINDS) expect(prompt, `the prompt never mentions "${kind}"`).toContain(kind);
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
  it('declares no numeric field anywhere in the schema', () => {
    expect(findNumberTypedFields(buildResponseSchema())).toEqual([]);
  });

  it('gives every branch exactly the allowed fields of its kind, kind first and sourceText last', () => {
    for (const [kind, branch] of Object.entries(actionBranchesOf(buildResponseSchema()))) {
      const declared = Object.keys(branch.properties);
      expect(new Set(declared)).toEqual(new Set(allowedFields(kind as ActionKind)));
      expect(declared[0]).toBe('kind');
      expect(declared[declared.length - 1]).toBe('sourceText');
      expect(declared).toEqual(ACTION_FIELDS.filter((f) => declared.includes(f)));
      expect(branch.required[0]).toBe('kind');
      expect(branch.required).toEqual(expect.arrayContaining(requiredFields(kind as ActionKind)));
    }
  });

  it('keeps one branch per kind, in ACTION_KINDS order', () => {
    expect(Object.keys(actionBranchesOf(buildResponseSchema()))).toEqual([...ACTION_KINDS]);
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
  it('keeps everything per-call out of the static instruction block', () => {
    const instructions = buildStaticInstructions();
    // Nothing per-call may appear in the cacheable prefix.
    expect(instructions).not.toContain('ALREADY ON THE CHART:\n');
    expect(instructions).not.toContain('AVAILABLE TEMPLATES in this practice:');
  });

  it('is deterministic — same registry in, same bytes out', () => {
    expect(buildStaticInstructions()).toBe(buildStaticInstructions());
  });
});
