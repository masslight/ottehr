import { describe, expect, it } from 'vitest';
import { RESPONSE_SCHEMA as AGENT_RESPONSE_SCHEMA } from '../src/ehr/easy-chart-agent/index';
import { RESPONSE_SCHEMA as JUDGE_RESPONSE_SCHEMA } from '../src/ehr/easy-chart-eval-judge/index';
import { RESPONSE_SCHEMA as REVIEW_RESPONSE_SCHEMA } from '../src/ehr/easy-chart-review/index';
import { coerceNumericFields, coerceNumericStepFields, RESPONSE_SCHEMA } from '../src/shared/easy-chart/planner-core';

// Digit-loop regression pins. Under Vertex constrained decoding a JSON number has NO closing token,
// so a `type:'number'` schema field is a trap: when flash-lite emits one on a step kind where it is
// meaningless (observed as `"value": 0.` on add-diagnosis), the digit run self-reinforces at
// temperature 0 and generates digits until the 16k token cap — 31% of run9 planner calls died at
// MAX_TOKENS exactly this way (and ~1% of review calls). The fix declares those fields as STRINGS
// (a closing quote is always available) and coerceNumericStepFields() restores the numeric contract
// server-side right after parse. These pins keep anyone from "fixing" the types back to `number`.

// Every `type` value reachable anywhere in a schema object (nested items/properties included).
const collectTypes = (node: unknown, path: string, out: Array<{ path: string; type: string }>): void => {
  if (!node || typeof node !== 'object') return;
  const record = node as Record<string, unknown>;
  if (typeof record.type === 'string') out.push({ path, type: record.type });
  for (const [key, child] of Object.entries(record)) {
    if (key === 'type' || key === 'enum' || key === 'required') continue;
    collectTypes(child, `${path}.${key}`, out);
  }
};

describe('easy-chart response schemas carry no raw number fields (digit-loop guard)', () => {
  it('planner RESPONSE_SCHEMA has no type:number anywhere', () => {
    const types: Array<{ path: string; type: string }> = [];
    collectTypes(RESPONSE_SCHEMA, 'RESPONSE_SCHEMA', types);
    expect(types.length).toBeGreaterThan(0);
    expect(types.filter((t) => t.type === 'number')).toEqual([]);
  });

  it('review RESPONSE_SCHEMA has no type:number anywhere', () => {
    const types: Array<{ path: string; type: string }> = [];
    collectTypes(REVIEW_RESPONSE_SCHEMA, 'REVIEW_RESPONSE_SCHEMA', types);
    expect(types.length).toBeGreaterThan(0);
    expect(types.filter((t) => t.type === 'number')).toEqual([]);
  });

  it('agent RESPONSE_SCHEMA has no type:number anywhere', () => {
    const types: Array<{ path: string; type: string }> = [];
    collectTypes(AGENT_RESPONSE_SCHEMA, 'AGENT_RESPONSE_SCHEMA', types);
    expect(types.length).toBeGreaterThan(0);
    expect(types.filter((t) => t.type === 'number')).toEqual([]);
  });

  it('eval-judge RESPONSE_SCHEMA has no type:number anywhere', () => {
    const types: Array<{ path: string; type: string }> = [];
    collectTypes(JUDGE_RESPONSE_SCHEMA, 'JUDGE_RESPONSE_SCHEMA', types);
    expect(types.length).toBeGreaterThan(0);
    expect(types.filter((t) => t.type === 'number')).toEqual([]);
  });
});

describe('coerceNumericStepFields (post-parse numeric-contract restoration)', () => {
  it('coerces a string vital value to a number', () => {
    const step: Record<string, unknown> = { kind: 'set-vital', field: 'temperature', value: '101.3', unit: 'F' };
    coerceNumericStepFields(step);
    expect(step.value).toBe(101.3);
  });

  it('coerces string systolic/diastolic to numbers', () => {
    const step: Record<string, unknown> = {
      kind: 'set-vital',
      field: 'blood-pressure',
      systolic: '120',
      diastolic: '80',
    };
    coerceNumericStepFields(step);
    expect(step.systolic).toBe(120);
    expect(step.diastolic).toBe(80);
  });

  it('coerces a string followUpInDays to a number', () => {
    const step: Record<string, unknown> = { kind: 'set-disposition', dispositionType: 'pcp', followUpInDays: '7' };
    coerceNumericStepFields(step);
    expect(step.followUpInDays).toBe(7);
  });

  it('deletes an empty-string value (same as the model omitting it)', () => {
    const step: Record<string, unknown> = { kind: 'set-vital', field: 'weight', value: '' };
    coerceNumericStepFields(step);
    expect('value' in step).toBe(false);
  });

  it('deletes a non-numeric string value', () => {
    const step: Record<string, unknown> = { kind: 'set-vital', field: 'weight', value: 'abc' };
    coerceNumericStepFields(step);
    expect('value' in step).toBe(false);
  });

  it('leaves an already-numeric value untouched (precomputed plans / backup path)', () => {
    const step: Record<string, unknown> = { kind: 'set-vital', field: 'temperature', value: 98.6 };
    coerceNumericStepFields(step);
    expect(step.value).toBe(98.6);
  });

  it('ignores steps without any numeric-contract fields', () => {
    const step: Record<string, unknown> = { kind: 'add-diagnosis', display: 'Acute pharyngitis', code: 'J02.9' };
    coerceNumericStepFields(step);
    expect(step).toEqual({ kind: 'add-diagnosis', display: 'Acute pharyngitis', code: 'J02.9' });
  });
});

describe('coerceNumericFields (judge scorecard score fields)', () => {
  it('coerces a string fidelityScore and freeText scores to numbers', () => {
    const scorecard: Record<string, unknown> = {
      fidelityScore: '72',
      freeText: [{ field: 'medicalDecision', score: '2', note: 'thin' }],
    };
    coerceNumericFields(scorecard, ['fidelityScore']);
    expect(scorecard.fidelityScore).toBe(72);
    const entry = (scorecard.freeText as Array<Record<string, unknown>>)[0];
    coerceNumericFields(entry, ['score']);
    expect(entry.score).toBe(2);
    expect(entry.note).toBe('thin');
  });

  it('deletes an empty-string score (same as the model omitting it)', () => {
    const entry: Record<string, unknown> = { field: 'chiefComplaint', score: '' };
    coerceNumericFields(entry, ['score']);
    expect('score' in entry).toBe(false);
  });

  it('deletes a non-numeric fidelityScore', () => {
    const scorecard: Record<string, unknown> = { fidelityScore: 'high' };
    coerceNumericFields(scorecard, ['fidelityScore']);
    expect('fidelityScore' in scorecard).toBe(false);
  });

  it('leaves an already-numeric score untouched', () => {
    const entry: Record<string, unknown> = { field: 'historyOfPresentIllness', score: 88 };
    coerceNumericFields(entry, ['score']);
    expect(entry.score).toBe(88);
  });
});
