import { describe, expect, it } from 'vitest';
import { RUNTIME_SCOPE_PARAM_NAMES } from './runtime-scope.catalog';
import { transpileReportJsx } from './transpile';

// The ONE transpiler for generated reports (see transpile.ts): the iframe runtime turns the stored
// JSX artifact into runnable JS with it at render time. These tests pin its contract.

describe('transpileReportJsx', () => {
  it('transpiles JSX (including a top-level return) to classic createElement calls', () => {
    const result = transpileReportJsx(`
      function ReportRoot() {
        return <Report.Section title="Visits"><Report.Kpi label="Total" value={data.length} /></Report.Section>;
      }
      return ReportRoot;
    `);
    expect('code' in result).toBe(true);
    if ('code' in result) {
      expect(result.code).toContain('React.createElement');
      expect(result.code).not.toContain('<Report.Section');
      // The output must still be a legal FUNCTION BODY — the exact form the iframe executes.
      expect(() => new Function(...RUNTIME_SCOPE_PARAM_NAMES, result.code)).not.toThrow();
    }
  });

  it('passes plain-JS artifacts through unchanged (pre-JSX saved reports keep working)', () => {
    const legacy = `function ReportRoot() { return React.createElement('div', null, data.length); }\nreturn ReportRoot;`;
    const result = transpileReportJsx(legacy);
    expect('code' in result && result.code.trim()).toBe(legacy.trim());
  });

  // The prompt demands null guards, so `?.` / `??` are everyday generated code — and for those
  // sucrase PREPENDS a runtime helper ahead of the wrapper. The helper must survive into the body
  // (otherwise the report dies with "_optionalChain is not defined") without shifting line numbers.
  it('keeps sucrase runtime helpers for optional chaining / nullish coalescing', () => {
    const source = [
      'function ReportRoot() {',
      '  const first = data[0] ?? {};',
      "  const label = first.nested?.[0]?.label ?? 'none';",
      '  return <div>{label}</div>;',
      '}',
      'return ReportRoot;',
    ].join('\n');
    const result = transpileReportJsx(source);
    expect('code' in result).toBe(true);
    if (!('code' in result)) return;

    const factory = new Function(...RUNTIME_SCOPE_PARAM_NAMES, result.code);
    const returned = factory({ createElement: (_t: unknown, _p: unknown, c: unknown) => c }, {}, {}, [], {});
    expect(typeof returned).toBe('function');
    expect((returned as () => unknown)()).toBe('none');
    // Line-preserving: the helper rides on the body's FIRST line, so error locations still map 1:1.
    expect(result.code.split('\n').length).toBe(source.split('\n').length);
  });

  it('is deterministic — the same artifact always yields the same runnable code', () => {
    const a = transpileReportJsx('return <div>{data.length}</div>;');
    const b = transpileReportJsx('return <div>{data.length}</div>;');
    expect('code' in a && 'code' in b && a.code === b.code).toBe(true);
  });

  it('surfaces broken JSX as an error (or as code the runtime Function-compile rejects)', () => {
    const result = transpileReportJsx(`function ReportRoot() { return <div>; } return ReportRoot;`);
    if ('error' in result) {
      expect(result.error).toBeTruthy();
    } else {
      expect(() => new Function('React', 'MUI', 'Report', 'data', 'schema', result.code)).toThrow();
    }
  });
});
