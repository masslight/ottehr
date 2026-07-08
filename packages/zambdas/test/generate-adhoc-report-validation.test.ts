import { describe, expect, it } from 'vitest';
import { jsSyntaxError } from '../src/ehr/generate-adhoc-report/index';

// The server must NEVER execute generated report code (executing untrusted model output server-side
// is an arbitrary-code-execution surface — the old vm/child-process execute-validator was removed).
// The only code-shaped check left is jsSyntaxError, which COMPILES the code as a function body via
// `new Function(...)` without ever invoking it; runtime validation happens in the client's sandboxed
// iframe. These tests pin both halves: it parses exactly what the iframe runner parses, and it never
// runs anything.

describe('generate-adhoc-report jsSyntaxError (compile-only)', () => {
  it('accepts ordinary code that renders into document.body', () => {
    const code = `
      const valid = data.filter(r => r.visitStatus !== 'cancelled');
      document.body.innerHTML = '<h2>' + valid.length + ' visits</h2>';
    `;
    expect(jsSyntaxError(code)).toBeNull();
  });

  it('accepts a top-level return guard (legal in a function body, not as a script)', () => {
    // The iframe runs code via new Function('data','schema','Chart', code), so a top-level `return`
    // is a normal early-exit — extremely common (empty-data guards). The check must not reject it.
    const code = `
      if (!data.length) { document.body.innerHTML = '<p>No data</p>'; return; }
      document.body.innerHTML = '<h2>' + data.length + ' visits</h2>';
    `;
    expect(jsSyntaxError(code)).toBeNull();
  });

  it('rejects code that does not parse, with the SyntaxError message', () => {
    const err = jsSyntaxError('const x = {;');
    expect(err).not.toBeNull();
    expect(typeof err).toBe('string');
  });

  it('never EXECUTES the code — only compiles it', () => {
    // Code with an unconditional throw and an observable side effect: if the check executed the
    // code, the throw would surface as an error and the global would be set. It compiles fine, so
    // the check must return null and leave the global untouched.
    const globalKey = '__adhocExecProbe';
    delete (globalThis as Record<string, unknown>)[globalKey];
    const code = `globalThis.${globalKey} = true; throw new Error('must never run');`;
    expect(jsSyntaxError(code)).toBeNull();
    expect((globalThis as Record<string, unknown>)[globalKey]).toBeUndefined();
  });
});
