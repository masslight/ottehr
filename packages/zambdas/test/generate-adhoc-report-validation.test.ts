import { describe, expect, it } from 'vitest';
import { explainRuntimeError } from '../src/ehr/generate-adhoc-report/index';

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
