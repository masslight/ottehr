// The one JSX→JS transpiler for generated reports, run by the iframe runtime just before execution
// (the zambda never transpiles or executes report code). A deterministic mechanical step.
//
// Sucrase is token-based and fast, and its JSX transform is an identity pass for code without JSX —
// so plain-JS artifacts (reports saved before this contract) still run unchanged.
import { transform } from 'sucrase';
// The same wrapper the runtime evaluates — both come from the runtime-scope catalog, so the injected
// parameters can never drift between transpilation, execution and the prompt. Deep import (not the
// utils barrel, not the zod-validating runtime-scope module) keeps the iframe bundle lean.
import { REPORT_WRAP_PREFIX as WRAP_PREFIX, REPORT_WRAP_SUFFIX as WRAP_SUFFIX } from './runtime-scope.catalog';

/** JSX function body → plain-JS function body, or the syntax error. Wrapped in a function first (so
 *  a top-level `return` is legal), then the wrapper is sliced back off.
 *
 *  Sucrase may PREPEND runtime helpers (`_optionalChain` for `a?.b`, `_nullishCoalesce` for `a ?? b`)
 *  ahead of the wrapper — and the model is told to guard nulls, so those are everyday code. The
 *  helpers are emitted inline on the wrapper's own line (sucrase never adds lines, which is what
 *  keeps stack-trace line numbers pointing into the model's JSX), so they are carried over to the
 *  front of the body's first line: hoisted function declarations, in scope, no line shift. */
export function transpileReportJsx(source: string): { code: string } | { error: string } {
  try {
    const wrapped = WRAP_PREFIX + source + WRAP_SUFFIX;
    const out = transform(wrapped, {
      transforms: ['jsx'],
      production: true,
      jsxPragma: 'React.createElement',
      jsxFragmentPragma: 'React.Fragment',
    }).code;
    const wrapperStart = out.indexOf(WRAP_PREFIX.trimEnd());
    const end = out.lastIndexOf('\n})');
    if (wrapperStart < 0 || end < 0 || !out.trimEnd().endsWith('})')) {
      // Defensive: sucrase should never rewrite the wrapper itself.
      return { error: 'transpilation produced an unexpected shape' };
    }
    // Everything before the wrapper is sucrase's helper prelude (same line, so no line shift).
    const helpers = out.slice(0, wrapperStart);
    const start = out.indexOf('\n', wrapperStart) + 1;
    return { code: helpers + out.slice(start, end) };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}
