import { LlmDatasetSchema } from 'utils/lib/types/adhoc/datasets/llm-schema';
import { describe, expect, it } from 'vitest';
import { parseNeedsDataset } from '../src/ehr/generate-adhoc-report/index';
import { explainRuntimeError } from '../src/shared/adhoc-generate';


// The generate zambda no longer executes or transpiles code — validation happens where the code
// runs (the sandboxed iframe over real rows), and failures come back through the client's bounded
// auto-repair as previousAttempt. What remains server-side is the repair-prompt preparation:
// translating the browser's opaque production-React errors into instructions the model can act on.
// (The transpiler contract itself is tested next to its implementation in utils.)

describe('explainRuntimeError (repair-prompt preparation)', () => {
  it('translates a top-level hook crash (null dispatcher) into an actionable instruction', () => {
    const explained = explainRuntimeError("Cannot read properties of null (reading 'useMemo')");
    expect(explained).toMatch(/OUTSIDE a component/);
    expect(explained).toMatch(/Top-level data preparation/);
  });

  it('translates the dev-mode variant of the same mistake', () => {
    expect(explainRuntimeError('Invalid hook call. Hooks can only be called inside…')).toMatch(/OUTSIDE a component/);
  });

  it('translates the object-as-React-child crash', () => {
    expect(explainRuntimeError('Objects are not valid as a React child (found: object with keys {a})')).toMatch(
      /join arrays first/
    );
  });

  it('passes unknown errors through untouched', () => {
    expect(explainRuntimeError('r is not defined')).toBe('r is not defined');
  });
});

describe('parseNeedsDataset (wrong-dataset signal)', () => {
  const schema: LlmDatasetSchema = {
    datasetId: 'encounters-comprehensive',
    label: 'Encounters',
    description: '',
    rowCount: 0,
    fields: [],
    otherDatasets: [{ id: 'billing', label: 'Billing', description: '' }],
  };

  it('keeps a pointer to one of the schema otherDatasets', () => {
    expect(parseNeedsDataset({ id: 'billing', concepts: ['payer balance', ''] }, schema)).toEqual({
      id: 'billing',
      concepts: ['payer balance'],
    });
  });

  it('drops an invented or current dataset id', () => {
    expect(parseNeedsDataset({ id: 'claims', concepts: ['x'] }, schema)).toBeUndefined();
    expect(parseNeedsDataset({ id: 'encounters-comprehensive', concepts: ['x'] }, schema)).toBeUndefined();
  });

  it('ignores a missing or malformed value', () => {
    expect(parseNeedsDataset(undefined, schema)).toBeUndefined();
    expect(parseNeedsDataset('billing', schema)).toBeUndefined();
  });
});
